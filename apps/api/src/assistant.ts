import { Injectable } from '@nestjs/common';
import { approvalPayload, containsSensitiveText, turnSchema, type Answer } from '@guide/contracts';
import { createHash } from 'node:crypto';
import { Configuration, operationReady } from './config';
import { ApiError } from './errors';
import { Sessions } from './sessions';
import { Providers } from './providers';
import { validateApprovedImage } from './approved-image';

@Injectable()
export class Assistant {
  private readonly active = new Map<string, { sessionId: string; requestId: string; controller: AbortController }>();
  constructor(private readonly config: Configuration, private readonly sessions: Sessions, private readonly providers: Providers) {}
  cancel(ownerUid: string, sessionId: string, requestId?: string) {
    const active = this.active.get(ownerUid);
    if (active?.sessionId === sessionId && (!requestId || active.requestId === requestId)) active.controller.abort();
  }
  cancelAll(ownerUid: string) { this.active.get(ownerUid)?.controller.abort(); }
  async turn(ownerUid: string, sessionId: string, input: unknown, disconnected?: AbortSignal): Promise<Answer> {
    const parsed = turnSchema.safeParse(input);
    if (!parsed.success) throw new ApiError('INVALID_INPUT');
    const turn = parsed.data;
    if(turn.source?.screenConsent && this.config.strictPrivacy)throw new ApiError('CLOUD_SCREEN_DISABLED',403);
    if (turn.source?.approvedImage) validateApprovedImage(turn.source.approvedImage);
    if (this.config.problems.some(problem => !problem.startsWith('SARVAM_'))) throw new ApiError('SERVICE_UNAVAILABLE', 503);
    if (this.config.groups && [turn.inputLocale, turn.replyLocale, turn.draftLocale].some(locale => locale && locale !== 'en-IN') && !operationReady(this.config, 'sarvam', 'translate')) throw new ApiError('TRANSLATION_UNAVAILABLE', 503);
    if (this.active.has(ownerUid)) throw new ApiError('TURN_IN_PROGRESS', 409);
    if (this.active.size >= 20) throw new ApiError('PROVIDER_BUSY', 429, 15000);
    if (containsSensitiveText(turn.question) || turn.source?.reviewedLabels.some(l => containsSensitiveText(l.text))) throw new ApiError('PRIVACY_REVIEW_REQUIRED');
    if (turn.source) {
      const hash = createHash('sha256').update(approvalPayload(turn.source)).digest('hex');
      if (hash !== turn.source.sanitizedHash) throw new ApiError('CONTEXT_REVIEW_REQUIRED');
      if (Date.parse(turn.source.capturedAt) > Date.now() + 30_000) throw new ApiError('CONTEXT_STALE', 409);
      if (turn.source.kind === 'desktop' && (Date.now() - Date.parse(turn.source.checkedAt!) > 5000 || Date.parse(turn.source.checkedAt!) > Date.now() + 1000)) throw new ApiError('CONTEXT_STALE', 409);
    }
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(90_000), ...(disconnected ? [disconnected] : [])]);
    this.active.set(ownerUid, { sessionId, requestId: turn.requestId, controller });
    try {
      await this.sessions.source(ownerUid, sessionId, turn);
      await this.sessions.claim(ownerUid, sessionId, turn);
      signal.throwIfAborted();
      const labels = turn.source?.reviewedLabels.map(l => l.text) || [];
      const questionEn = turn.screenOverview ? 'Briefly describe what the supplied screenshot appears to show, without reading out personal details. Then ask: What would you like help with? Do not invent a task or claim this snapshot is a live screen.' : await this.providers.translate(turn.question, turn.inputLocale, 'en-IN', labels, signal);
      if (containsSensitiveText(questionEn)) throw new ApiError('PRIVACY_REVIEW_REQUIRED');
      const recent = await this.sessions.recent(ownerUid, sessionId);
      const model = await this.providers.reason(questionEn, turn, signal, recent.map(item => ({ question: item.question, guidance: item.answer.explanation, draft: item.answer.draft?.text || null })));
      signal.throwIfAborted();
      const explanation = await this.providers.translate(model.explanationEn, 'en-IN', turn.replyLocale, [...new Set([...labels, ...(model.observedLabels || [])])], signal);
      const draft = model.draftEn && turn.draftLocale ? { locale: turn.draftLocale, text: await this.providers.translate(model.draftEn, 'en-IN', turn.draftLocale, [], signal) } : null;
      signal.throwIfAborted();
      const answer: Answer = { requestId: turn.requestId, sourceVersion: turn.source?.version ?? null, status: model.status, explanation: { locale: turn.replyLocale, text: explanation }, draft, referencedLabels: (turn.source?.reviewedLabels || []).filter(l => model.referencedLabels.includes(l.id)), evidence: [{ kind: turn.source?.approvedImage ? 'approved-image' : turn.source ? 'approved-labels' : turn.taskKind === 'draft-text' ? 'draft' : 'user-description' }], requiresFreshContext: model.requiresFreshContext, completionBasis: 'not_completed' };
      await this.sessions.finish(ownerUid, sessionId, turn.requestId, turn, answer);
      signal.throwIfAborted();
      return answer;
    } catch (error) {
      if (signal.aborted) { const canceled = controller.signal.aborted || disconnected?.aborted; throw new ApiError(canceled ? 'TURN_CANCELED' : 'TURN_TIMEOUT', canceled ? 408 : 504); }
      throw error;
    } finally { this.active.delete(ownerUid); }
  }
}
