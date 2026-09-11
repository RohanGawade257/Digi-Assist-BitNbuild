import { Injectable } from '@nestjs/common';
import { Database, objectId } from './database';
import { ApiError } from './errors';
import { createHash } from 'node:crypto';
import { defaultPreferences, preferencesSchema, type Turn } from '@guide/contracts';

@Injectable()
export class Sessions {
  constructor(private readonly database: Database) {}
  async create(ownerUid: string) {
    const db = await this.database.get(); const now = new Date();
    const result = await db.collection('sessions').insertOne({ ownerUid, historyEnabled: false, status: 'open', latestSourceVersion: 0, createdAt: now, updatedAt: now, expiresAt: new Date(now.getTime() + 900_000) });
    return { id: result.insertedId.toHexString(), historyEnabled: false, expiresAt: new Date(now.getTime() + 900_000).toISOString() };
  }
  async owned(ownerUid: string, id: string) {
    const session = await (await this.database.get()).collection('sessions').findOne({ _id: objectId(id), ownerUid, status: 'open', expiresAt: { $gt: new Date() } });
    if (!session) throw new ApiError('SESSION_CLOSED', 404);
    return session;
  }
  async close(ownerUid: string, id: string) {
    const result = await (await this.database.get()).collection('sessions').updateOne({ _id: objectId(id), ownerUid, status: 'open', expiresAt: { $gt: new Date() } }, { $set: { status: 'deleted', expiresAt: new Date(), updatedAt: new Date() } });
    if (!result.matchedCount) throw new ApiError('SESSION_CLOSED', 404);
  }
  async source(ownerUid: string, id: string, turn: Turn) {
    const session = await this.owned(ownerUid, id);
    if (!turn.source) return;
    if (turn.source.version < session.latestSourceVersion || (turn.source.version === session.latestSourceVersion && session.sourceHash !== turn.source.sanitizedHash)) throw new ApiError('CONTEXT_STALE', 409);
    const result = await (await this.database.get()).collection('sessions').updateOne({ _id: objectId(id), ownerUid, status: 'open', expiresAt: { $gt: new Date() }, latestSourceVersion: { $lte: turn.source.version } }, { $set: { latestSourceVersion: turn.source.version, sourceHash: turn.source.sanitizedHash } });
    if (!result.matchedCount) throw new ApiError('CONTEXT_STALE', 409);
  }
  async claim(ownerUid: string, sessionId: string, turn: Turn) {
    const db = await this.database.get();
    const fingerprint = createHash('sha256').update(JSON.stringify({ sessionId, ...turn })).digest('hex');
    try { await db.collection('requestRecords').insertOne({ ownerUid, sessionId, requestId: turn.requestId, fingerprint, status: 'processing', expiresAt: new Date(Date.now() + 86400_000) }); }
    catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      const existing = await db.collection('requestRecords').findOne({ ownerUid, requestId: turn.requestId });
      throw new ApiError(existing?.fingerprint === fingerprint ? 'REQUEST_ALREADY_USED' : 'REQUEST_CONFLICT', 409);
    }
  }
  async finish(ownerUid: string, sessionId: string, requestId: string) {
    await this.owned(ownerUid, sessionId);
    await (await this.database.get()).collection('requestRecords').updateOne({ ownerUid, requestId }, { $set: { status: 'done' } });
    const updated = await (await this.database.get()).collection('sessions').updateOne({ _id: objectId(sessionId), ownerUid, status: 'open', expiresAt: { $gt: new Date() } }, { $set: { updatedAt: new Date(), expiresAt: new Date(Date.now() + 900_000) } });
    if (!updated.matchedCount) throw new ApiError('SESSION_CLOSED', 404);
  }
  async preferences(ownerUid: string, patch?: unknown) {
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
