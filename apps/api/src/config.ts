import { Injectable } from '@nestjs/common';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

const groupSchema = z.object({ id: z.string().min(1), provider: z.enum(['gemini', 'sarvam']), rpm: z.number().int().positive(), tpm: z.number().int().positive(), rpd: z.number().int().positive() }).strict();
export const quotaSchema = z.object({ schemaVersion: z.literal(2), verified: z.literal(true), groups: z.array(groupSchema).min(2) }).strict();
export type Operation = 'generate' | 'translate' | 'transcribe' | 'speak';
const limitSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('verified'), value: z.number().int().positive(), evidence: z.string().min(1) }).strict(),
  z.object({ status: z.literal('unpublished'), evidence: z.string().min(1) }).strict(),
  z.object({ status: z.literal('unverified') }).strict()
]);
export const quotaPolicyV3Schema = z.object({ schemaVersion: z.literal(3), groups: z.array(z.object({
  id: z.string().min(1), provider: z.enum(['gemini', 'sarvam']), apis: z.array(z.object({
    operation: z.enum(['generate', 'translate', 'transcribe', 'speak']), model: z.string().optional(),
    verified: z.boolean(), limits: z.object({ rpm: limitSchema, tpm: limitSchema, rpd: limitSchema }).strict()
  }).strict()).min(1)
}).strict()).min(1) }).strict();
export type QuotaGroup = { id: string; provider: 'gemini' | 'sarvam'; operation?: Operation; rpm?: number; tpm?: number; rpd?: number };
export type Slot = { secret: string; group: string; id: string; operation?: Operation };
export function operationReady(config: Configuration, provider: 'gemini' | 'sarvam', operation: Operation) {
  return !config.problems.some(problem => !problem.startsWith('GEMINI_') && !problem.startsWith('SARVAM_')) &&
    !(provider === 'gemini' && !config.model) && Boolean(config.groups.some(group => group.id === config.slots[provider]?.[0]?.group && group.provider === provider && (!group.operation || group.operation === operation)));
}
@Injectable()
export class Configuration {
  readonly env = process.env;
  readonly problems: string[] = [];
  readonly groups: QuotaGroup[] = [];
  readonly slots: Record<'gemini' | 'sarvam', Slot[]> = { gemini: [], sarvam: [] };
  readonly pendingPolicies: string[] = [];
  readonly port: number;
  readonly origins: string[];
  readonly mongoUri: string;
  readonly projectId: string;
  readonly model: string;
  readonly translationModel: string;
  readonly credentialsPath: string;
  readonly strictPrivacy = process.env.STRICT_PRIVACY_MODE !== 'false';
  constructor() {
    this.port = Number(this.env.PORT || 3001);
    if (!Number.isInteger(this.port) || this.port < 1 || this.port > 65535) { this.problems.push('PORT'); this.port = 3001; }
    this.origins = (this.env.API_ALLOWED_ORIGINS || 'http://localhost:3000').split(',').map(s => s.trim());
    if (this.origins.some(s => { try { const u = new URL(s); return u.origin !== s || !['http:', 'https:'].includes(u.protocol) || (u.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(u.hostname)); } catch { return true; } })) this.problems.push('API_ALLOWED_ORIGINS');
    this.mongoUri = this.env.MONGODB_URI || '';
    this.projectId = this.env.FIREBASE_PROJECT_ID || '';
    this.model = this.env.GEMINI_MODEL || '';
    this.translationModel = this.env.SARVAM_TRANSLATION_MODEL || 'sarvam-translate:v1';
    const creds = this.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (creds) {
      if (existsSync(creds)) {
        this.credentialsPath = resolve(creds);
      } else {
        const altCreds = [
          resolve(process.cwd(), creds),
          resolve(__dirname, creds),
          resolve(process.cwd(), creds.replace(/^(\.\.[\/\\])+/, '')),
          resolve(__dirname, '../../../', creds.replace(/^(\.\.[\/\\])+/, ''))
        ];
        const found = altCreds.find(p => existsSync(p));
        this.credentialsPath = found ? resolve(found) : resolve(creds);
      }
    } else {
      this.credentialsPath = '';
    }
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
      let rawText = this.env.QUOTA_POLICY_RAW || this.env.QUOTA_POLICY_JSON;
      if (!rawText) {
        const rawPath = this.env.QUOTA_POLICY_PATH || '../../config/quota-policy.json';
        const candidatePaths = [
          rawPath,
          resolve(process.cwd(), rawPath),
          resolve(__dirname, rawPath),
          resolve(process.cwd(), rawPath.replace(/^(\.\.[\/\\])+/, '')),
          resolve(process.cwd(), 'config/quota-policy.json'),
          resolve(__dirname, '../../../config/quota-policy.json'),
          resolve(__dirname, '../../config/quota-policy.json')
        ];
        const found = candidatePaths.find(p => p && existsSync(p));
        if (!found) throw new Error('Quota policy file not found');
        rawText = readFileSync(found, 'utf8');
      }
      const raw = JSON.parse(rawText);
      const policy = raw.schemaVersion === 3 ? quotaPolicyV3Schema.parse(raw) : quotaSchema.parse(raw);
      if (policy.schemaVersion === 2) this.groups.push(...policy.groups);
      else for (const group of policy.groups) {
        const operations = new Set<string>();
        for (const api of group.apis) {
          if (operations.has(api.operation) || (group.provider === 'gemini') !== (api.operation === 'generate')) throw new Error('Invalid operation');
          operations.add(api.operation);
          const limits = Object.values(api.limits);
          if (!api.verified || api.limits.rpm.status !== 'verified' || limits.some(limit => limit.status === 'unverified') || (group.provider === 'gemini' && api.model !== this.model)) { this.pendingPolicies.push(`${group.id}:${api.operation}`); continue; }
          this.groups.push({ id: group.id, provider: group.provider, operation: api.operation, ...Object.fromEntries(Object.entries(api.limits).filter(([, limit]) => limit.status === 'verified').map(([key, limit]) => [key, limit.status === 'verified' ? limit.value : undefined])) });
        }
      }
      if (new Set(policy.groups.map(g => g.id)).size !== policy.groups.length) this.problems.push('QUOTA_POLICY_DUPLICATE_GROUP');
      for (const provider of ['gemini', 'sarvam'] as const) for (const slot of this.slots[provider]) if (!policy.groups.some(g => g.id === slot.group && g.provider === provider)) this.problems.push('QUOTA_POLICY_GROUP_MISMATCH');
    } catch { this.problems.push('QUOTA_POLICY_PATH'); }
  }
}
