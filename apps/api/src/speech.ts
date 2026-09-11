import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { audioRequestSchema, containsSensitiveText, inspectWave, splitText, transcriptionSchema } from '@guide/contracts';
import { Configuration } from './config';
import { Sessions } from './sessions';
import { Providers } from './providers';
import { ApiError } from './errors';

@Injectable()
export class Speech {
  private readonly active = new Map<string, { id: string; controller: AbortController }>();
  constructor(private readonly config: Configuration, private readonly sessions: Sessions, private readonly providers: Providers) {}
  cancel(uid: string, id?: string) { const item = this.active.get(uid); if (item && (!id || item.id === id)) item.controller.abort(); }
  private async run<T>(uid: string, id: string, disconnected: AbortSignal, work: (signal: AbortSignal) => Promise<T>) {
    if (this.config.problems.some(problem => !problem.startsWith('GEMINI_'))) throw new ApiError('SERVICE_UNAVAILABLE', 503);
    await this.sessions.owned(uid, id);
    if (this.active.has(uid)) throw new ApiError('TURN_IN_PROGRESS', 409);
    if (this.active.size >= 20) throw new ApiError('PROVIDER_BUSY', 429, 15000);
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, disconnected, AbortSignal.timeout(30_000)]);
    this.active.set(uid, { id, controller });
    try { const result = await work(signal); signal.throwIfAborted(); await this.sessions.owned(uid, id); signal.throwIfAborted(); return result; }
    catch (error) { if (signal.aborted) throw new ApiError('TURN_CANCELED', 408); throw error; }
    finally { this.active.delete(uid); }
  }
  async transcribe(uid: string, id: string, metadata: unknown, bytes: Uint8Array, signal: AbortSignal) {
    if (this.config.strictPrivacy) throw new ApiError('CLOUD_SPEECH_DISABLED', 403);
    const parsed = transcriptionSchema.safeParse(metadata);
    if (!parsed.success) throw new ApiError('INVALID_INPUT');
    let wave: ReturnType<typeof inspectWave>;
    try { wave = inspectWave(bytes); } catch { throw new ApiError('INVALID_AUDIO'); }
    const view = new DataView(wave.data.buffer, wave.data.byteOffset, wave.data.byteLength);
    let energy = 0;
    for (let i = 0; i < wave.data.length; i += 2) energy += (view.getInt16(i, true) / 32768) ** 2;
    if (Math.sqrt(energy / (wave.data.length / 2)) < 0.003) throw new ApiError('SPEECH_UNCLEAR', 422);
    return this.run(uid, id, signal, async operation => {
      await this.sessions.claim(uid, id, { ...parsed.data, operation: 'transcribe', audioHash: createHash('sha256').update(bytes).digest('hex') });
      const transcript = await this.providers.transcribe(bytes, parsed.data.inputLocale, operation);
      if (containsSensitiveText(transcript)) throw new ApiError('PRIVACY_REVIEW_REQUIRED');
      return { transcript, locale: parsed.data.inputLocale, requiresCorrectionReview: !parsed.data.automaticConversation };
    });
  }
  async audio(uid: string, id: string, requestId: string, input: unknown, signal: AbortSignal) {
    const parsed = audioRequestSchema.safeParse(input);
    if (!parsed.success) throw new ApiError('INVALID_INPUT');
    const turns = await this.sessions.recent(uid, id);
    const answer = turns.find(item => item.answer.requestId === requestId)?.answer;
    const segment = answer?.[parsed.data.segment];
    const text = segment && splitText(segment.text)[parsed.data.chunk];
    if (!segment || !text) throw new ApiError('AUDIO_EXPIRED', 404);
    return this.run(uid, id, signal, operation => this.providers.speak(text, segment.locale, parsed.data.pace, operation));
  }
}
