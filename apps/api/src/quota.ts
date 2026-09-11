import { Injectable } from '@nestjs/common';
import { Configuration, type Operation, type Slot } from './config';
import { Database } from './database';
import { ApiError } from './errors';
import { delay } from './transport';

@Injectable()
export class Quota {
  private readonly disabled = new Set<string>();
  private waiting = 0;
  constructor(private readonly config: Configuration, private readonly database: Database) {}
  async reserve(provider: 'gemini' | 'sarvam', tokenBound: number, operation: Operation = provider === 'gemini' ? 'generate' : 'translate'): Promise<Slot> {
    // Same-account slots share each API bucket; legacy policies share all operations.
    const primary = this.config.slots[provider][0];
    const slot = this.config.slots[provider].find(s => s.group === primary?.group && !this.disabled.has(s.id));
    if (!slot) throw new ApiError('SERVICE_UNAVAILABLE', 503);
    const group = this.config.groups.find(g => g.id === slot.group && g.provider === provider && (!g.operation || g.operation === operation));
    if (!group || !Number.isSafeInteger(tokenBound) || tokenBound < 0) throw new ApiError('SERVICE_UNAVAILABLE', 503);
    const bucket = group.operation && provider === 'sarvam' ? `${group.id}:${operation}` : group.id;
    const db = await this.database.get();
    const cooldown = await db.collection<{ _id: string; retryAt: Date }>('providerHealth').findOne({ _id: bucket });
    if (cooldown && cooldown.retryAt.getTime() > Date.now()) throw new ApiError('PROVIDER_BUSY', 429, cooldown.retryAt.getTime() - Date.now());
    const windows = db.collection<{ _id: string; minute: number; day: number; minuteRequests: number; dayRequests: number; tokens: number }>('quotaAccounts');
    const now = Date.now();
    const minute = Math.floor(now / 60_000) * 60_000, day = Math.floor(now / 86400_000) * 86400_000;
    // Carry forward the first slice's counters; upgrading must not reset spent quota.
    const legacy = await db.collection<{ _id: string; requests: number; tokens: number }>('quotaWindows').find({ _id: { $in: [`${group.id}:60000:${minute}`, `${group.id}:86400000:${day}`] } }).toArray();
    const oldMinute = legacy.find(item => item._id === `${group.id}:60000:${minute}`), oldDay = legacy.find(item => item._id === `${group.id}:86400000:${day}`);
    const previous = bucket !== group.id ? await windows.findOne({ _id: group.id }) : null;
    try { await windows.updateOne({ _id: bucket }, { $setOnInsert: { minute, day, minuteRequests: Math.max(oldMinute?.requests || 0, previous?.minute === minute ? previous.minuteRequests : 0), dayRequests: Math.max(oldDay?.requests || 0, previous?.day === day ? previous.dayRequests : 0), tokens: Math.max(oldMinute?.tokens || 0, previous?.minute === minute ? previous.tokens : 0) } }, { upsert: true }); }
    catch (error) { if ((error as { code?: number }).code !== 11000) throw error; }
    const effective = (period: 'minute' | 'day', field: string) => ({ $cond: [{ $lt: [`$${period}`, period === 'minute' ? minute : day] }, 0, `$${field}`] });
    const mr = effective('minute', 'minuteRequests'), dr = effective('day', 'dayRequests'), tokens = effective('minute', 'tokens');
    // Atomic combined debit; older concurrent requests cannot reset a newer window.
    const result = await windows.updateOne({ _id: bucket, $expr: { $and: [
      { $lte: ['$minute', minute] }, { $lte: ['$day', day] },
      ...(group.rpm !== undefined ? [{ $lt: [mr, group.rpm] }] : []),
      ...(group.rpd !== undefined ? [{ $lt: [dr, group.rpd] }] : []), ...(group.tpm !== undefined ? [{ $lte: [tokens, group.tpm - tokenBound] }] : [])
    ] } }, [{ $set: { minute, day, minuteRequests: { $add: [mr, 1] }, dayRequests: { $add: [dr, 1] }, tokens: { $add: [tokens, tokenBound] } } }]);
    if (!result.matchedCount) {
      const state = await windows.findOne({ _id: bucket });
      throw new ApiError('PROVIDER_BUSY', 429, group.rpd !== undefined && state?.day === day && state.dayRequests >= group.rpd ? day + 86400_000 - now : minute + 60_000 - now);
    }
    return { ...slot, ...(group.operation ? { operation } : {}) };
  }
  async scheduled(provider: 'gemini' | 'sarvam', tokens: number, signal: AbortSignal, operation: Operation = provider === 'gemini' ? 'generate' : 'translate'): Promise<Slot> {
    signal.throwIfAborted();
    try { return await this.reserve(provider, tokens, operation); }
    catch (error) {
      if (!(error instanceof ApiError) || error.code !== 'PROVIDER_BUSY' || !error.retryAfterMs || error.retryAfterMs > 15_000 || this.waiting >= 20) throw error;
      this.waiting++;
      try { await delay(error.retryAfterMs + 20, signal); signal.throwIfAborted(); return await this.reserve(provider, tokens, operation); }
      finally { this.waiting--; }
    }
  }
  async limited(slot: Slot, retryAfter: string | null) {
    const seconds = Number(retryAfter);
    const parsed = retryAfter && !Number.isFinite(seconds) ? Date.parse(retryAfter) - Date.now() : seconds * 1000;
    const delay = Math.max(60_000, Number.isFinite(parsed) ? parsed : 60_000);
    await (await this.database.get()).collection<{ _id: string; retryAt: Date }>('providerHealth').updateOne({ _id: slot.operation && slot.operation !== 'generate' ? `${slot.group}:${slot.operation}` : slot.group }, { $max: { retryAt: new Date(Date.now() + delay) } }, { upsert: true });
  }
  disable(slot: Slot) { this.disabled.add(slot.id); }
}
