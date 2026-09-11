import { z } from 'zod';

export const locales = ['en-IN', 'hi-IN', 'bn-IN', 'mr-IN', 'te-IN', 'ta-IN', 'ur-IN'] as const;
export const localeSchema = z.enum(locales);
export type Locale = z.infer<typeof localeSchema>;
export const languageNames: Record<Locale, string> = { 'en-IN': 'English', 'hi-IN': 'हिन्दी', 'bn-IN': 'বাংলা', 'mr-IN': 'मराठी', 'te-IN': 'తెలుగు', 'ta-IN': 'தமிழ்', 'ur-IN': 'اردو' };
export const labelSchema = z.object({ id: z.string().regex(/^label_[0-9]+$/), text: z.string().trim().min(1).max(160) }).strict();
export const sourceSchema = z.object({
  kind: z.enum(['screenshot', 'description']), version: z.number().int().positive(),
  capturedAt: z.iso.datetime(), contextMode: z.literal('reviewed-labels'),
  reviewedLabels: z.array(labelSchema).min(1).max(20),
  selectedTarget: z.object({ labelId: z.string(), sourceVersion: z.number().int().positive() }).strict().nullable(),
  userReviewed: z.literal(true), sanitizedHash: z.string().regex(/^[a-f0-9]{64}$/)
}).strict().superRefine((s, ctx) => {
  if (new Set(s.reviewedLabels.map(l => l.id)).size !== s.reviewedLabels.length) ctx.addIssue({ code: 'custom', message: 'Duplicate labels' });
  if (s.selectedTarget && (s.selectedTarget.sourceVersion !== s.version || !s.reviewedLabels.some(l => l.id === s.selectedTarget?.labelId))) ctx.addIssue({ code: 'custom', message: 'Invalid target' });
});
export type Source = z.infer<typeof sourceSchema>;
// The same canonical payload is hashed on both sides; selection never implies approval.
export function approvalPayload(s: Pick<Source, 'kind' | 'version' | 'capturedAt' | 'reviewedLabels' | 'selectedTarget'>) {
  return JSON.stringify({ kind: s.kind, version: s.version, capturedAt: s.capturedAt, reviewedLabels: s.reviewedLabels.map(l => ({ id: l.id, text: l.text })), selectedTarget: s.selectedTarget ? { labelId: s.selectedTarget.labelId, sourceVersion: s.selectedTarget.sourceVersion } : null });
}
export const turnSchema = z.object({
  requestId: z.uuid(), question: z.string().trim().min(1).max(2000),
  inputLocale: localeSchema, replyLocale: localeSchema, draftLocale: localeSchema.nullable(),
  taskKind: z.enum(['general-help', 'guide-task', 'draft-text']), inputMode: z.literal('text'),
  source: sourceSchema.nullable(), nonSensitiveConfirmed: z.literal(true)
}).strict().superRefine((t, ctx) => {
  if (t.taskKind === 'draft-text' && !t.draftLocale) ctx.addIssue({ code: 'custom', message: 'Choose draft language', path: ['draftLocale'] });
});
export type Turn = z.infer<typeof turnSchema>;
export const modelResultSchema = z.object({
  status: z.enum(['answer', 'clarify', 'insufficient_context']),
  explanationEn: z.string().min(1).max(4000), draftEn: z.string().max(6000).nullable(),
  referencedLabels: z.array(z.string()).max(20),
  requiresFreshContext: z.boolean(), completionBasis: z.literal('not_completed')
}).strict();
export type ModelResult = z.infer<typeof modelResultSchema>;
export type Answer = {
  requestId: string; sourceVersion: number | null; status: ModelResult['status'];
  explanation: { locale: Locale; text: string }; draft: { locale: Locale; text: string } | null;
  referencedLabels: z.infer<typeof labelSchema>[]; evidence: { kind: 'user-description' | 'approved-labels' | 'draft' }[];
  requiresFreshContext: boolean; completionBasis: 'not_completed';
};
export const preferencesSchema = z.object({
  replyLocale: localeSchema, interfaceLocale: localeSchema,
  screenReaderMode: z.boolean(), textScale: z.number().min(1).max(2), saveHistory: z.literal(false)
}).strict();
export const defaultPreferences = { replyLocale: 'en-IN', interfaceLocale: 'en-IN', screenReaderMode: false, textScale: 1, saveHistory: false } as const;
// A detection aid, not a claim that arbitrary personal information can be classified.
export function containsSensitiveText(text: string): boolean {
  return /[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b\d[\d\s-]{7,}\d\b|\b[A-Z]{5}\d{4}[A-Z]\b|(?:password|otp|api[_ -]?key|secret)\s*[:=]\s*\S+/i.test(text);
}
