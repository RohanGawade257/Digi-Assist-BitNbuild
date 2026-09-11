import { z } from 'zod';
export { protectLabels } from './labels';
export { inspectWave, pcmWave, splitText, joinWaves } from './media';
export { imageDimensions } from './image';

export const locales = ['en-IN', 'hi-IN', 'bn-IN', 'mr-IN', 'te-IN', 'ta-IN', 'ur-IN'] as const;
export const localeSchema = z.enum(locales);
// Bulbul v3's documented output set excludes Urdu; do not bill unsupported requests.
export const speechOutputLocales = locales.filter(locale => locale !== 'ur-IN');
export type Locale = z.infer<typeof localeSchema>;
export const languageNames: Record<Locale, string> = { 'en-IN': 'English', 'hi-IN': 'हिन्दी', 'bn-IN': 'বাংলা', 'mr-IN': 'मराठी', 'te-IN': 'తెలుగు', 'ta-IN': 'தமிழ்', 'ur-IN': 'اردو' };
export const labelSchema = z.object({ id: z.string().regex(/^label_[0-9]+$/), text: z.string().trim().min(1).max(160) }).strict();
export const MAX_APPROVED_IMAGE_BYTES = 2 * 1024 * 1024;
export const approvedImageSchema = z.object({
  mimeType: z.literal('image/png'), data: z.string().min(40).max(4 * Math.ceil(MAX_APPROVED_IMAGE_BYTES / 3)).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
  width: z.number().int().positive().max(2048), height: z.number().int().positive().max(2048),
  sha256: z.string().regex(/^[a-f0-9]{64}$/), analysisConsent: z.literal(true)
}).strict().refine(image => image.width * image.height <= 4_000_000, 'Image too large');
export type ApprovedImage = z.infer<typeof approvedImageSchema>;
export const sourceSchema = z.object({
  kind: z.enum(['screenshot', 'description', 'desktop']), version: z.number().int().positive(),
  capturedAt: z.iso.datetime(), contextMode: z.enum(['reviewed-labels', 'approved-image']),
  reviewedLabels: z.array(labelSchema).max(20), approvedImage: approvedImageSchema.optional(),
  selectedTarget: z.object({ labelId: z.string(), sourceVersion: z.number().int().positive(), normalizedRegion: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().positive().max(1), height: z.number().positive().max(1) }).strict().optional() }).strict().nullable(),
  checkedAt: z.iso.datetime().optional(),
  userReviewed: z.literal(true), sanitizedHash: z.string().regex(/^[a-f0-9]{64}$/)
}).strict().superRefine((s, ctx) => {
  if (s.contextMode === 'approved-image' ? (!s.approvedImage || s.kind === 'description') : (Boolean(s.approvedImage) || !s.reviewedLabels.length)) ctx.addIssue({ code: 'custom', message: 'Explicit image approval or reviewed labels required' });
  if (new Set(s.reviewedLabels.map(l => l.id)).size !== s.reviewedLabels.length) ctx.addIssue({ code: 'custom', message: 'Duplicate labels' });
  if (s.selectedTarget && (s.selectedTarget.sourceVersion !== s.version || !s.reviewedLabels.some(l => l.id === s.selectedTarget?.labelId))) ctx.addIssue({ code: 'custom', message: 'Invalid target' });
  const region = s.selectedTarget?.normalizedRegion;
  if (region && (region.x + region.width > 1 || region.y + region.height > 1)) ctx.addIssue({ code: 'custom', message: 'Region outside preview' });
  if (s.kind === 'desktop' && !s.checkedAt) ctx.addIssue({ code: 'custom', message: 'Freshness check required' });
});
export type Source = z.infer<typeof sourceSchema>;
// The same canonical payload is hashed on both sides; selection never implies approval.
export function approvalPayload(s: Pick<Source, 'kind' | 'version' | 'capturedAt' | 'reviewedLabels' | 'selectedTarget'> & Partial<Pick<Source, 'contextMode' | 'approvedImage'>>) {
  return JSON.stringify({ kind: s.kind, version: s.version, capturedAt: s.capturedAt, reviewedLabels: s.reviewedLabels.map(l => ({ id: l.id, text: l.text })), selectedTarget: s.selectedTarget ? { labelId: s.selectedTarget.labelId, sourceVersion: s.selectedTarget.sourceVersion, ...(s.selectedTarget.normalizedRegion ? { normalizedRegion: s.selectedTarget.normalizedRegion } : {}) } : null, ...(s.contextMode === 'approved-image' && s.approvedImage ? { contextMode: s.contextMode, image: { mimeType: s.approvedImage.mimeType, width: s.approvedImage.width, height: s.approvedImage.height, sha256: s.approvedImage.sha256, analysisConsent: s.approvedImage.analysisConsent } } : {}) });
}
export const turnSchema = z.object({
  requestId: z.uuid(), question: z.string().trim().min(1).max(2000),
  inputLocale: localeSchema, replyLocale: localeSchema, draftLocale: localeSchema.nullable(),
  taskKind: z.enum(['general-help', 'guide-task', 'draft-text']), inputMode: z.enum(['text', 'voice']),
  source: sourceSchema.nullable(), nonSensitiveConfirmed: z.literal(true)
}).strict().superRefine((t, ctx) => {
  if (t.taskKind === 'draft-text' && !t.draftLocale) ctx.addIssue({ code: 'custom', message: 'Choose draft language', path: ['draftLocale'] });
});
export type Turn = z.infer<typeof turnSchema>;
export const modelResultSchema = z.object({
  status: z.enum(['answer', 'clarify', 'insufficient_context']),
  explanationEn: z.string().min(1).max(4000), draftEn: z.string().max(6000).nullable(),
  referencedLabels: z.array(z.string()).max(20),
  observedLabels: z.array(z.string().min(1).max(160)).max(20).default([]),
  requiresFreshContext: z.boolean(), completionBasis: z.literal('not_completed')
}).strict();
export type ModelResult = z.infer<typeof modelResultSchema>;
export type Answer = {
  requestId: string; sourceVersion: number | null; status: ModelResult['status'];
  explanation: { locale: Locale; text: string }; draft: { locale: Locale; text: string } | null;
  referencedLabels: z.infer<typeof labelSchema>[]; evidence: { kind: 'user-description' | 'approved-labels' | 'approved-image' | 'draft' }[];
  requiresFreshContext: boolean; completionBasis: 'not_completed';
};
export const answerSchema = z.object({ requestId: z.uuid(), sourceVersion: z.number().int().positive().nullable(), status: modelResultSchema.shape.status,
  explanation: z.object({ locale: localeSchema, text: z.string() }).strict(), draft: z.object({ locale: localeSchema, text: z.string() }).strict().nullable(),
  referencedLabels: z.array(labelSchema), evidence: z.array(z.object({ kind: z.enum(['user-description', 'approved-labels', 'approved-image', 'draft']) }).strict()), requiresFreshContext: z.boolean(), completionBasis: z.literal('not_completed') }).strict();
export const preferencesSchema = z.object({
  replyLocale: localeSchema, interfaceLocale: localeSchema,
  screenReaderMode: z.boolean(), textScale: z.number().min(1).max(2), saveHistory: z.boolean(),
  audioEnabled: z.boolean(), speechRate: z.number().min(0.5).max(1.5), chatPinned: z.boolean(), chatShortcutEnabled: z.boolean()
}).strict();
export type Preferences = z.infer<typeof preferencesSchema>;
export const defaultPreferences: Preferences = { replyLocale: 'en-IN', interfaceLocale: 'en-IN', screenReaderMode: false, textScale: 1, saveHistory: false, audioEnabled: false, speechRate: 1, chatPinned: false, chatShortcutEnabled: false };
export const newSessionSchema = z.object({ historyEnabled: z.boolean() }).strict();
export const transcriptionSchema = z.object({ requestId: z.uuid(), inputLocale: localeSchema, cloudSpeechConsent: z.literal(true), automaticConversation: z.boolean().optional() }).strict();
export const audioRequestSchema = z.object({ segment: z.enum(['explanation', 'draft']), chunk: z.number().int().min(0).max(20), pace: z.number().min(0.5).max(1.5).default(1) }).strict();
export const feedbackSchema = z.object({ sessionId: z.string().regex(/^[a-f0-9]{24}$/).nullable(), rating: z.enum(['helpful', 'not-helpful']), text: z.string().max(500).default(''), saveConsent: z.literal(true), locale: localeSchema }).strict();
// A detection aid, not a claim that arbitrary personal information can be classified.
export function containsSensitiveText(text: string): boolean {
  const normalized = text.replace(/[०-९০-৯௦-௯౦-౯۰-۹٠-٩]/g, char => { const point = char.charCodeAt(0); const base = [0x966, 0x9e6, 0xbe6, 0xc66, 0x6f0, 0x660].find(start => point >= start && point <= start + 9)!; return String(point - base); });
  return /[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b\d[\d\s-]{7,}\d\b|\b[A-Z]{5}\d{4}[A-Z]\b|(?:password|otp|api[_ -]?key|secret)\s*[:=]\s*\S+/i.test(normalized);
}
