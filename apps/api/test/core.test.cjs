const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash, randomUUID } = require('node:crypto');
const { turnSchema, sourceSchema, approvalPayload, enabledLocales: locales, containsSensitiveText } = require('@guide/contracts');
const { Assistant } = require('../dist/assistant');
const { Providers } = require('../dist/providers');
const { Configuration, quotaSchema, operationReady } = require('../dist/config');
const { AuthGuard } = require('../dist/auth');

function turn(overrides = {}) { return { requestId: randomUUID(), question: 'Explain how to attach a file.', inputLocale: 'en-IN', replyLocale: 'en-IN', draftLocale: null, taskKind: 'general-help', inputMode: 'text', source: null, nonSensitiveConfirmed: true, ...overrides }; }
function source() { const s = { kind: 'screenshot', version: 1, capturedAt: new Date().toISOString(), contextMode: 'reviewed-labels', reviewedLabels: [{ id: 'label_1', text: 'Attach files' }], selectedTarget: { labelId: 'label_1', sourceVersion: 1 }, userReviewed: true }; s.sanitizedHash = createHash('sha256').update(approvalPayload(s)).digest('hex'); return s; }
const model = { status: 'answer', explanationEn: 'Choose Attach files.', draftEn: null, referencedLabels: ['label_1'], requiresFreshContext: false, completionBasis: 'not_completed' };
const sessionDouble = () => ({ source: async () => {}, claim: async () => {}, finish: async () => {}, recent: async () => [] });

test('all five enabled locales accept Unicode; draft language is explicit and independent', () => {
  for (const locale of locales) assert.ok(turnSchema.safeParse(turn({ question: 'हिन्दी বাংলা मराठी తెలుగు தமிழ் اردو', inputLocale: locale, replyLocale: locale })).success);
  assert.ok(!turnSchema.safeParse(turn({ taskKind: 'draft-text' })).success);
  assert.ok(turnSchema.safeParse(turn({ taskKind: 'draft-text', replyLocale: 'hi-IN', draftLocale: 'en-IN' })).success);
  for (const bad of [{ ownerUid: 'other' }, { inputLocale: 'xx' }, { question: 'x'.repeat(2001) }, { nonSensitiveConfirmed: false }, { rawImage: 'private' }]) assert.ok(!turnSchema.safeParse(turn(bad)).success);
});
test('context rejects wrong target version, duplicate IDs, unknown fields and unreviewed content', () => {
  assert.ok(sourceSchema.safeParse(source()).success);
  for (const bad of [{ selectedTarget: { labelId: 'label_1', sourceVersion: 2 } }, { selectedTarget: { labelId: 'missing', sourceVersion: 1 } }, { userReviewed: false }, { reviewedLabels: [source().reviewedLabels[0], source().reviewedLabels[0]] }, { rawOCR: 'private' }]) assert.ok(!sourceSchema.safeParse({ ...source(), ...bad }).success);
});
test('synthetic identifiers are detected while useful public labels remain', () => {
  for (const text of ['person@example.test', '1234 5678 9012', 'ABCDE1234F', 'password: secret-value']) assert.ok(containsSensitiveText(text));
  assert.equal(containsSensitiveText('Mobile Number: use the number you can access'), false);
});
test('unknown quotas cannot become unlimited', () => {
  assert.equal(quotaSchema.safeParse({ schemaVersion: 2, verified: false, groups: [] }).success, false);
  const configuration = new Configuration();
  assert.ok(configuration.problems.includes('GEMINI_MODEL'));
  assert.equal(operationReady(configuration, 'gemini', 'generate'), false);
});
test('guard rejects absent or malformed tokens and uses verified identity', async () => {
  let checked = '';
  const guard = new AuthGuard({ verify: async token => { checked = token; return { uid: 'owner', emailVerified: true }; } });
  const req = { headers: {} };
  const context = { switchToHttp: () => ({ getRequest: () => req }) };
  await assert.rejects(guard.canActivate(context), e => e.code === 'AUTH_REQUIRED');
  req.headers.authorization = 'Bearer signed-test-token'; await guard.canActivate(context);
  assert.equal(checked, 'signed-test-token'); assert.equal(req.identity.uid, 'owner');
});
test('tampered approval and sensitive text fail before any provider call', async () => {
  const assistant = new Assistant({ problems: [] }, sessionDouble(), { translate: () => { throw new Error('must not call'); } });
  await assert.rejects(assistant.turn('a', 's', turn({ source: { ...source(), sanitizedHash: 'a'.repeat(64) } })), e => e.code === 'CONTEXT_REVIEW_REQUIRED');
  await assert.rejects(assistant.turn('a', 's', turn({ question: 'Email me at person@example.test' })), e => e.code === 'PRIVACY_REVIEW_REQUIRED');
});
test('Hindi explanation retains an English draft via independent pipeline stages', async () => {
  const stages = [];
  const provider = { translate: async (text, from, to) => { stages.push([from, to, text]); return from === to ? text : to === 'hi-IN' ? 'यह आपका मसौदा है।' : 'Draft an email.'; }, reason: async () => ({ ...model, draftEn: 'Dear [recipient],\nPlease send the public instructions.', referencedLabels: [] }) };
  const assistant = new Assistant({ problems: [] }, sessionDouble(), provider);
  const result = await assistant.turn('a', 's', turn({ taskKind: 'draft-text', inputLocale: 'hi-IN', replyLocale: 'hi-IN', draftLocale: 'en-IN' }));
  assert.equal(result.explanation.locale, 'hi-IN'); assert.equal(result.draft.locale, 'en-IN'); assert.match(result.draft.text, /^Dear/);
  assert.deepEqual(stages.map(s => s.slice(0, 2)), [['hi-IN', 'en-IN'], ['en-IN', 'hi-IN'], ['en-IN', 'en-IN']]);
});
test('follow-up reasoning receives prior guidance without carrying old source evidence', async () => {
  const sessions = sessionDouble();
  sessions.recent = async () => [{ question: 'Where do I begin?', answer: { explanation: { locale: 'en-IN', text: 'Read the public instructions.' }, draft: null, referencedLabels: [{ id: 'old_label', text: 'Old screen label' }] } }];
  let received;
  const provider = { translate: async text => text, reason: async (_question, current, _signal, recent) => { received = { current, recent }; return { ...model, referencedLabels: [] }; } };
  const assistant = new Assistant({ problems: [] }, sessions, provider);
  await assistant.turn('a', 's', turn({ question: 'I have done the previous step. What next?' }));
  assert.equal(received.current.source, null);
  assert.deepEqual(received.recent, [{ question: 'Where do I begin?', guidance: { locale: 'en-IN', text: 'Read the public instructions.' }, draft: null }]);
  assert.ok(!JSON.stringify(received.recent).includes('old_label'));
});

test('cancellation discards late provider result and blocks simultaneous user turns', async () => {
  let resolve; let called;
  const started = new Promise(r => { called = r; });
  const provider = { translate: async t => t, reason: async () => { called(); return new Promise(r => { resolve = r; }); } };
  const sessions = sessionDouble(); let finished = false; sessions.finish = async () => { finished = true; };
  const assistant = new Assistant({ problems: [] }, sessions, provider);
  const request = turn(); const answer = assistant.turn('a', 's', request); await started;
  await assert.rejects(assistant.turn('a', 's2', turn()), e => e.code === 'TURN_IN_PROGRESS');
  assistant.cancel('a', 's', request.requestId); resolve(model);
  await assert.rejects(answer, e => e.code === 'TURN_CANCELED'); assert.equal(finished, false);
});
test('missing source and unsupported rule evidence clarify without billing Gemini', async () => {
  const p = new Providers({}, { scheduled: () => { throw new Error('must not bill'); } });
  assert.equal((await p.reason('Which button?', turn({ taskKind: 'guide-task' }), new AbortController().signal)).status, 'clarify');
  assert.equal((await p.reason('What is the deadline?', turn(), new AbortController().signal)).status, 'insufficient_context');
});
test('real Sarvam adapter restores labels and rejects corrupted protected tokens', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  let captured;
  global.fetch = async (url, options) => { captured = { url, body: JSON.parse(options.body), headers: options.headers }; return new Response(JSON.stringify({ translated_text: 'चुनें __GUIDE_LABEL_0__' })); };
  const p = new Providers({ translationModel: 'sarvam-translate:v1' }, { scheduled: async () => ({ secret: 'test-only', group: 'g', id: 'slot' }) });
  const result = await p.translate('Choose Attach files', 'en-IN', 'hi-IN', ['Attach files'], new AbortController().signal);
  assert.equal(result, 'चुनें Attach files'); assert.equal(captured.body.model, 'sarvam-translate:v1'); assert.equal(captured.headers['api-subscription-key'], 'test-only');
  global.fetch = async () => new Response(JSON.stringify({ translated_text: 'चुनें बदला गया' }));
  await assert.rejects(p.translate('Choose Attach files', 'en-IN', 'hi-IN', ['Attach files'], new AbortController().signal), e => e.code === 'LABEL_TRANSLATION_FAILED');
});
test('Gemini adapter validates schema, labels, finish reason and bounded 429 without key rotation', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  let reserved = 0; let limited = 0;
  const p = new Providers({ model: 'configured-model' }, { scheduled: async () => { reserved++; return { secret: 'test-only', group: 'shared', id: 'slot' }; }, limited: async () => { limited++; } });
  global.fetch = async () => new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(model) }] } }] }));
  assert.equal((await p.reason('Attach a file', turn({ source: source() }), new AbortController().signal)).status, 'answer');
  await assert.rejects(p.reason('Attach a file', turn(), new AbortController().signal), e => e.code === 'PROVIDER_INVALID_RESPONSE');
  global.fetch = async () => new Response('{}', { status: 429, headers: { 'retry-after': '60' } });
  await assert.rejects(p.reason('Attach a file', turn(), new AbortController().signal), e => e.code === 'PROVIDER_BUSY');
  assert.equal(limited, 1); assert.equal(reserved, 3);
});
