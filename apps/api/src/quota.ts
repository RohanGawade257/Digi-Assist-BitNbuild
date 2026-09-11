import { Injectable } from '@nestjs/common';
import { Configuration, type Slot } from './config';
import { Database } from './database';
import { ApiError } from './errors';

@Injectable()
export class Quota {
  private readonly disabled = new Set<string>();
  constructor(private readonly config: Configuration, private readonly database: Database) {}
  async reserve(provider: 'gemini' | 'sarvam', tokenBound: number): Promise<Slot> {
    // Same-account slots share every bucket, including cross-operation usage.
    const slot = this.config.slots[provider].find(s => !this.disabled.has(s.id));
    if (!slot) throw new ApiError('SERVICE_UNAVAILABLE', 503);
    const group = this.config.groups.find(g => g.id === slot.group && g.provider === provider);
    if (!group) throw new ApiError('SERVICE_UNAVAILABLE', 503);
    const db = await this.database.get();
    const cooldown = await db.collection<{ _id: string; retryAt: Date }>('providerHealth').findOne({ _id: group.id });
    if (cooldown && cooldown.retryAt.getTime() > Date.now()) throw new ApiError('PROVIDER_BUSY', 429, cooldown.retryAt.getTime() - Date.now());
    const windows = db.collection<{ _id: string; requests: number; tokens: number; expiresAt: Date }>('quotaWindows');
    const now = Date.now();
    // Conservative debits are retained if a later reservation fails; never retry billing to undo them.
    for (const [period, cap, tokens] of [[86400_000, group.rpd, Number.MAX_SAFE_INTEGER], [60_000, Math.min(group.rpm, provider === 'gemini' ? 5 : 10), group.tpm]] as const) {
      const start = Math.floor(now / period) * period;
      const id = `${group.id}:${period}:${start}`;
      try { await windows.updateOne({ _id: id }, { $setOnInsert: { requests: 0, tokens: 0, expiresAt: new Date(start + period + 86400_000) } }, { upsert: true }); }
      catch (error) { if ((error as { code?: number }).code !== 11000) throw error; }
      const result = await windows.updateOne({ _id: id, requests: { $lt: cap }, tokens: { $lte: tokens - tokenBound } }, { $inc: { requests: 1, tokens: tokenBound } });
      if (!result.matchedCount) throw new ApiError('PROVIDER_BUSY', 429, start + period - now);
    }
    return slot;
  }
  async limited(slot: Slot, retryAfter: string | null) {
    const seconds = Number(retryAfter);
    const parsed = retryAfter && !Number.isFinite(seconds) ? Date.parse(retryAfter) - Date.now() : seconds * 1000;
    const delay = Math.max(60_000, Number.isFinite(parsed) ? parsed : 60_000);
    await (await this.database.get()).collection<{ _id: string; retryAt: Date }>('providerHealth').updateOne({ _id: slot.group }, { $max: { retryAt: new Date(Date.now() + delay) } }, { upsert: true });
  }
  disable(slot: Slot) { this.disabled.add(slot.id); }
}
