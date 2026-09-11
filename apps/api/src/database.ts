import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { Db, MongoClient, ObjectId } from 'mongodb';
import { Configuration } from './config';
import { ApiError } from './errors';

@Injectable()
export class Database implements OnApplicationShutdown {
  private client?: MongoClient;
  private connection?: Promise<Db>;
  constructor(private readonly config: Configuration) {}
  async get(): Promise<Db> {
    if (!this.config.mongoUri) throw new ApiError('SERVICE_UNAVAILABLE', 503);
    if (!this.connection) {
      this.connection = this.connect().catch(() => { this.connection = undefined; throw new ApiError('SERVICE_UNAVAILABLE', 503); });
    }
    return this.connection;
  }
  private async connect() {
    this.client = new MongoClient(this.config.mongoUri, { serverSelectionTimeoutMS: 2500, connectTimeoutMS: 2500, maxPoolSize: 10 });
    try {
      await this.client.connect();
      const db = this.client.db(this.config.env.MONGO_DATABASE || 'digital_assistant');
      await Promise.all([
        db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
        db.collection('sessions').createIndex({ ownerUid: 1, updatedAt: -1 }),
        db.collection('users').createIndex({ firebaseUid: 1 }, { unique: true }),
        db.collection('requestRecords').createIndex({ ownerUid: 1, requestId: 1 }, { unique: true }),
        db.collection('requestRecords').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
        db.collection('feedback').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
        db.collection('quotaWindows').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
      ]);
      return db;
    } catch { await this.client.close(); throw new ApiError('SERVICE_UNAVAILABLE', 503); }
  }
  async ping() { try { await (await this.get()).command({ ping: 1 }); return true; } catch { return false; } }
  async onApplicationShutdown() { await this.client?.close(); }
}
export function objectId(id: string) { if (!/^[a-f0-9]{24}$/.test(id)) throw new ApiError('NOT_FOUND', 404); return new ObjectId(id); }
