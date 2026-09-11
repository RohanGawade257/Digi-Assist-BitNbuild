import { Injectable } from '@nestjs/common';
import { Database, objectId } from './database';
import { ApiError } from './errors';
import { createHash } from 'node:crypto';
import { defaultPreferences, preferencesSchema, feedbackSchema, containsSensitiveText, type Turn, type Answer } from '@guide/contracts';

@Injectable()
export class Sessions {
  private readonly memory = new Map<string, { ownerUid: string; expires: number; turns: { question: string; answer: Answer }[] }>();
  private readonly sweep = setInterval(() => { for (const [id, item] of this.memory) if (item.expires <= Date.now()) this.memory.delete(id); }, 30_000).unref();
  constructor(private readonly database: Database) {}
  onApplicationShutdown() { clearInterval(this.sweep); this.memory.clear(); }
  async accountAllowed(ownerUid: string) {
    if (await (await this.database.get()).collection('users').findOne({ firebaseUid: ownerUid, deleting: true })) throw new ApiError('ACCOUNT_DELETING', 403);
  }
  async create(ownerUid: string, historyEnabled = false) {
    await this.accountAllowed(ownerUid);
    const db = await this.database.get(); const now = new Date();
    const expiresAt = new Date(now.getTime() + (historyEnabled ? 30 * 86400_000 : 900_000));
    const result = await db.collection('sessions').insertOne({ ownerUid, historyEnabled, status: 'open', latestSourceVersion: 0, createdAt: now, updatedAt: now, expiresAt, idleExpiresAt: new Date(now.getTime() + 900_000) });
    try { await this.accountAllowed(ownerUid); } catch (error) { await db.collection('sessions').deleteOne({ _id: result.insertedId, ownerUid }); throw error; }
    return { id: result.insertedId.toHexString(), historyEnabled, expiresAt: new Date(now.getTime() + 900_000).toISOString() };
  }
  async owned(ownerUid: string, id: string) {
    await this.accountAllowed(ownerUid);
    const session = await (await this.database.get()).collection('sessions').findOne({ _id: objectId(id), ownerUid, status: 'open', expiresAt: { $gt: new Date() }, $or: [{ idleExpiresAt: { $exists: false } }, { idleExpiresAt: { $gt: new Date() } }] });
    if (!session) throw new ApiError('SESSION_CLOSED', 404);
    return session;
  }
  async close(ownerUid: string, id: string) {
    const result = await (await this.database.get()).collection('sessions').updateOne({ _id: objectId(id), ownerUid, status: { $in: ['open', 'closed'] }, expiresAt: { $gt: new Date() } }, { $set: { status: 'deleted', expiresAt: new Date(), updatedAt: new Date() }, $unset: { turns: '' } });
    this.memory.delete(id);
    if (!result.matchedCount) throw new ApiError('SESSION_CLOSED', 404);
  }
  async source(ownerUid: string, id: string, turn: Turn) {
    const session = await this.owned(ownerUid, id);
    if (!turn.source) return;
    if (turn.source.version < session.latestSourceVersion || (turn.source.version === session.latestSourceVersion && session.sourceHash !== turn.source.sanitizedHash)) throw new ApiError('CONTEXT_STALE', 409);
    const result = await (await this.database.get()).collection('sessions').updateOne({ _id: objectId(id), ownerUid, status: 'open', expiresAt: { $gt: new Date() }, $or: [{ latestSourceVersion: { $lt: turn.source.version } }, { latestSourceVersion: turn.source.version, sourceHash: turn.source.sanitizedHash }] }, { $set: { latestSourceVersion: turn.source.version, sourceHash: turn.source.sanitizedHash } });
    if (!result.matchedCount) throw new ApiError('CONTEXT_STALE', 409);
  }
  async claim(ownerUid: string, sessionId: string, turn: { requestId: string; [key: string]: unknown }) {
    const db = await this.database.get();
    const fingerprint = createHash('sha256').update(JSON.stringify({ sessionId, ...turn })).digest('hex');
    try { await db.collection('requestRecords').insertOne({ ownerUid, sessionId, requestId: turn.requestId, fingerprint, status: 'processing', expiresAt: new Date(Date.now() + 86400_000) }); }
    catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      const existing = await db.collection('requestRecords').findOne({ ownerUid, requestId: turn.requestId });
      throw new ApiError(existing?.fingerprint === fingerprint ? 'REQUEST_ALREADY_USED' : 'REQUEST_CONFLICT', 409);
    }
  }
  async finish(ownerUid: string, sessionId: string, requestId: string, turn?: Turn, answer?: Answer) {
    const session = await this.owned(ownerUid, sessionId);
    await (await this.database.get()).collection('requestRecords').updateOne({ ownerUid, requestId }, { $set: { status: 'done' } });
    const updated = await (await this.database.get()).collection<{ ownerUid: string; status: string; expiresAt: Date; turns: { question: string; answer: Answer }[] }>('sessions').updateOne({ _id: objectId(sessionId), ownerUid, status: 'open', expiresAt: { $gt: new Date() } }, { $set: { updatedAt: new Date(), idleExpiresAt: new Date(Date.now() + 900_000), ...(!session.historyEnabled ? { expiresAt: new Date(Date.now() + 900_000) } : {}) }, ...(session.historyEnabled && turn && answer ? { $push: { turns: { $each: [{ question: turn.question, answer }], $slice: -50 } } } : {}) });
    if (!updated.matchedCount) throw new ApiError('SESSION_CLOSED', 404);
    if (turn && answer) {
      const old = this.memory.get(sessionId);
      if (this.memory.size >= 1000 && !old) this.memory.delete(this.memory.keys().next().value!);
      this.memory.set(sessionId, { ownerUid, expires: Date.now() + 900_000, turns: [...(old?.turns || []), { question: turn.question, answer }].slice(-6) });
    }
  }
  async recent(ownerUid: string, id: string) {
    await this.owned(ownerUid, id); const item = this.memory.get(id);
    if (!item || item.ownerUid !== ownerUid || item.expires <= Date.now()) { this.memory.delete(id); return []; }
    return item.turns;
  }
  async end(ownerUid: string, id: string) {
    const session = await this.owned(ownerUid, id);
    if (!session.historyEnabled) return this.close(ownerUid, id);
    await (await this.database.get()).collection('sessions').updateOne({ _id: objectId(id), ownerUid, status: 'open' }, { $set: { status: 'closed', updatedAt: new Date() } });
    this.memory.delete(id);
  }
  async list(ownerUid: string) {
    await this.accountAllowed(ownerUid);
    return { items: await (await this.database.get()).collection('sessions').find({ ownerUid, historyEnabled: true, status: { $in: ['open', 'closed'] }, expiresAt: { $gt: new Date() } }, { projection: { _id: 1, updatedAt: 1, expiresAt: 1 } }).sort({ updatedAt: -1 }).limit(50).toArray() };
  }
  async history(ownerUid: string, id: string) {
    await this.accountAllowed(ownerUid);
    const item = await (await this.database.get()).collection('sessions').findOne({ _id: objectId(id), ownerUid, historyEnabled: true, status: { $in: ['open', 'closed'] }, expiresAt: { $gt: new Date() } });
    if (!item) throw new ApiError('NOT_FOUND', 404);
    return { id, turns: item.turns || [], expiresAt: item.expiresAt };
  }
  async feedback(ownerUid: string, input: unknown) {
    const parsed = feedbackSchema.safeParse(input);
    if (!parsed.success || containsSensitiveText(parsed.data?.text || '')) throw new ApiError('PRIVACY_REVIEW_REQUIRED');
    await this.accountAllowed(ownerUid);
    if (parsed.data.sessionId) await this.owned(ownerUid, parsed.data.sessionId);
    const db = await this.database.get();
    const inserted = await db.collection('feedback').insertOne({ ownerUid, ...parsed.data, expiresAt: new Date(Date.now() + 90 * 86400_000) });
    try { await this.accountAllowed(ownerUid); } catch (error) { await db.collection('feedback').deleteOne({ _id: inserted.insertedId }); throw error; }
  }
  async eraseAccount(ownerUid: string) {
    const db = await this.database.get();
    await db.collection('users').updateOne({ firebaseUid: ownerUid }, { $set: { deleting: true } }, { upsert: true });
    for (const [id, item] of this.memory) if (item.ownerUid === ownerUid) this.memory.delete(id);
    await db.collection('sessions').deleteMany({ ownerUid });
    await db.collection('requestRecords').deleteMany({ ownerUid });
    await db.collection('feedback').deleteMany({ ownerUid });
    // Retain only a UID tombstone to block in-flight/revoked-token writes.
    await db.collection('users').replaceOne({ firebaseUid: ownerUid }, { firebaseUid: ownerUid, deleting: true });
  }
  async preferences(ownerUid: string, patch?: unknown) {
    await this.accountAllowed(ownerUid);
    const users = (await this.database.get()).collection('users');
    if (patch !== undefined) {
      const parsed = preferencesSchema.partial().safeParse(patch);
      if (!parsed.success) throw new ApiError('INVALID_INPUT');
      await users.updateOne({ firebaseUid: ownerUid }, { $set: { ...parsed.data, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
    }
    const record = await users.findOne({ firebaseUid: ownerUid });
    return Object.fromEntries(Object.entries(defaultPreferences).map(([key, fallback]) => [key, record?.[key] ?? fallback]));
  }
}
