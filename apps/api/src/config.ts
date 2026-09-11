import { Injectable } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

const groupSchema = z.object({ id: z.string().min(1), provider: z.enum(['gemini', 'sarvam']), rpm: z.number().int().positive(), tpm: z.number().int().positive(), rpd: z.number().int().positive() }).strict();
export const quotaSchema = z.object({ schemaVersion: z.literal(2), verified: z.literal(true), groups: z.array(groupSchema).min(2) }).strict();
export type QuotaGroup = z.infer<typeof groupSchema>;
export type Slot = { secret: string; group: string; id: string };
@Injectable()
export class Configuration {
  readonly env = process.env;
  readonly problems: string[] = [];
  readonly groups: QuotaGroup[] = [];
  readonly slots: Record<'gemini' | 'sarvam', Slot[]> = { gemini: [], sarvam: [] };
  readonly port: number;
  readonly origins: string[];
  readonly mongoUri: string;
  readonly projectId: string;
  readonly model: string;
  readonly translationModel: string;
  readonly credentialsPath: string;
  constructor() {
    this.port = Number(this.env.PORT || 3001);
    if (!Number.isInteger(this.port) || this.port < 1 || this.port > 65535) { this.problems.push('PORT'); this.port = 3001; }
    this.origins = (this.env.API_ALLOWED_ORIGINS || 'http://localhost:3000').split(',').map(s => s.trim());
    if (this.origins.some(s => { try { const u = new URL(s); return u.origin !== s || !['http:', 'https:'].includes(u.protocol) || (u.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(u.hostname)); } catch { return true; } })) this.problems.push('API_ALLOWED_ORIGINS');
    this.mongoUri = this.env.MONGODB_URI || '';
    this.projectId = this.env.FIREBASE_PROJECT_ID || '';
    this.model = this.env.GEMINI_MODEL || '';
    this.translationModel = this.env.SARVAM_TRANSLATION_MODEL || 'sarvam-translate:v1';
    this.credentialsPath = this.env.GOOGLE_APPLICATION_CREDENTIALS ? resolve(this.env.GOOGLE_APPLICATION_CREDENTIALS) : '';
    for (const [key, value] of [['MONGODB_URI', this.mongoUri], ['FIREBASE_PROJECT_ID', this.projectId], ['GEMINI_MODEL', this.model], ['GOOGLE_APPLICATION_CREDENTIALS', this.credentialsPath]]) if (!value) this.problems.push(key!);
    if (this.env.FIREBASE_AUTH_EMULATOR_HOST) this.problems.push('FIREBASE_AUTH_EMULATOR_HOST_NOT_ALLOWED');
    if (this.env.PERSIST_RAW_MEDIA && this.env.PERSIST_RAW_MEDIA !== 'false') this.problems.push('PERSIST_RAW_MEDIA');
    if (this.env.HISTORY_DEFAULT_ENABLED && this.env.HISTORY_DEFAULT_ENABLED !== 'false') this.problems.push('HISTORY_DEFAULT_ENABLED');
    if (this.env.REQUIRE_EMAIL_VERIFIED && this.env.REQUIRE_EMAIL_VERIFIED !== 'true') this.problems.push('REQUIRE_EMAIL_VERIFIED');
    for (const provider of ['gemini', 'sarvam'] as const) {
      const seen = new Set<string>();
      for (let i = 1; i <= (provider === 'gemini' ? 4 : 3); i++) {
        const prefix = provider.toUpperCase();
        const secret = this.env[`${prefix}_API_KEY_${i}`]?.trim();
        if (!secret || seen.has(secret)) continue;
        seen.add(secret);
        const group = this.env[`${prefix}_QUOTA_GROUP_${i}`] || `${provider}-main`;
        this.slots[provider].push({ secret, group, id: `${provider}_${i}` });
      }
      if (!this.slots[provider].length) this.problems.push(`${provider.toUpperCase()}_API_KEY_1`);
    }
    try {
      const policy = quotaSchema.parse(JSON.parse(readFileSync(this.env.QUOTA_POLICY_PATH || '../../config/quota-policy.json', 'utf8')));
      this.groups.push(...policy.groups);
      if (new Set(policy.groups.map(g => g.id)).size !== policy.groups.length) this.problems.push('QUOTA_POLICY_DUPLICATE_GROUP');
      for (const provider of ['gemini', 'sarvam'] as const) for (const slot of this.slots[provider]) if (!this.groups.some(g => g.id === slot.group && g.provider === provider)) this.problems.push('QUOTA_POLICY_GROUP_MISMATCH');
    } catch { this.problems.push('QUOTA_POLICY_PATH'); }
  }
}
