// Real MongoDB + real Nest HTTP. Identity and AI are explicit injected test doubles.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { Test } = require('@nestjs/testing');
const { AppModule } = require('../dist/app');
const { Configuration } = require('../dist/config');
const { IdentityService } = require('../dist/auth');
const { Database } = require('../dist/database');
const { Providers } = require('../dist/providers');
const { Sessions } = require('../dist/sessions');
const { Quota } = require('../dist/quota');
const { ApiError, SafeErrors } = require('../dist/errors');
const { approvalPayload } = require('@guide/contracts');

test('real database ownership, lifecycle, quota concurrency and HTTP boundary', async t => {
  assert.ok(process.env.MONGODB_URI, 'Run setup-local.ps1 and docker compose up -d mongo first');
  const databaseName = `guide_test_${randomUUID().replaceAll('-', '')}`;
  const config = { env: { MONGO_DATABASE: databaseName }, mongoUri: process.env.MONGODB_URI, problems: [], slots: { gemini: [1, 2, 3, 4].map(i => ({ secret: `test_${i}`, id: `g_${i}`, group: 'same-project' })), sarvam: [{ secret: 'test_s', id: 's_1', group: 'same-account' }] }, groups: [{ id: 'same-project', provider: 'gemini', rpm: 2, tpm: 1000, rpd: 10 }, { id: 'same-account', provider: 'sarvam', rpm: 2, tpm: 1000, rpd: 10 }] };
  let providerCalls = 0; let pendingResolve; let signalStarted;
  const model = { status: 'answer', explanationEn: 'Read the public instructions.', draftEn: null, referencedLabels: [], requiresFreshContext: false, completionBasis: 'not_completed' };
  const provider = { translate: async text => text, reason: async question => { providerCalls++; if (question === 'Wait for cancellation') { signalStarted(); return new Promise(resolve => { pendingResolve = resolve; }); } return model; } };
  const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(Configuration).useValue(config).overrideProvider(IdentityService).useValue({ configured: true, verify: async token => { if (!['alice', 'bob', 'unverified'].includes(token)) throw new ApiError('AUTH_REQUIRED', 401); return { uid: token, emailVerified: token !== 'unverified' }; } }).overrideProvider(Providers).useValue(provider).compile();
  const app = module.createNestApplication({ logger: false }); app.setGlobalPrefix('api/v1'); app.useGlobalFilters(new SafeErrors()); await app.listen(0, '127.0.0.1');
  const dbProvider = module.get(Database); const db = await dbProvider.get();
  t.after(async () => { assert.match(db.databaseName, /^guide_test_[a-f0-9]+$/); await db.dropDatabase(); await app.close(); await dbProvider.onApplicationShutdown(); });
  const base = await app.getUrl();
  async function call(path, token = 'alice', method = 'GET', body) { return fetch(`${base}/api/v1${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); }
  function turn(overrides = {}) { return { requestId: randomUUID(), question: 'Describe a digital task', inputLocale: 'en-IN', replyLocale: 'en-IN', draftLocale: null, taskKind: 'general-help', inputMode: 'text', source: null, nonSensitiveConfirmed: true, ...overrides }; }
  await t.test('public health works, private routes require token and verified email', async () => {
    assert.equal((await call('/health', '')).status, 200);
    for (const route of ['/capabilities', '/me', '/sessions']) assert.equal((await call(route, '')).status, 401);
    assert.equal((await call('/sessions', 'unverified', 'POST', { historyEnabled: false })).status, 403);
    assert.equal((await call('/sessions', 'alice', 'POST', { historyEnabled: true })).status, 400);
  });
  const created = await call('/sessions', 'alice', 'POST', { historyEnabled: false }); assert.equal(created.status, 201); const sessionId = (await created.json()).id;
  await t.test('cross-user read, turn, cancel and delete cannot access a session', async () => {
    for (const [path, method, body] of [[`/sessions/${sessionId}`, 'GET'], [`/sessions/${sessionId}`, 'DELETE'], [`/sessions/${sessionId}/turns`, 'POST', turn()], [`/sessions/${sessionId}/turns/${randomUUID()}/cancel`, 'POST']]) assert.equal((await call(path, 'bob', method, body)).status, 404);
    assert.equal(providerCalls, 0);
  });
  await t.test('turn returns one answer; identical replay and different payload never rebill', async () => {
    const input = turn(); const path = `/sessions/${sessionId}/turns`;
    assert.equal((await call(path, 'alice', 'POST', input)).status, 200);
    assert.equal((await call(path, 'alice', 'POST', input)).status, 409);
    const conflict = await call(path, 'alice', 'POST', { ...input, question: 'Changed question' }); assert.equal(conflict.status, 409); assert.equal((await conflict.json()).code, 'REQUEST_CONFLICT');
    assert.equal(providerCalls, 1);
    const stored = await db.collection('requestRecords').findOne({ requestId: input.requestId }); assert.ok(!JSON.stringify(stored).includes(input.question));
    assert.equal(await db.collection('messages').countDocuments(), 0);
  });
  await t.test('source version and hash cannot be reused for a changed view', async () => {
    const source = { kind: 'screenshot', version: 2, capturedAt: new Date().toISOString(), contextMode: 'reviewed-labels', reviewedLabels: [{ id: 'label_1', text: 'Compose' }], selectedTarget: null, userReviewed: true };
    source.sanitizedHash = createHash('sha256').update(approvalPayload(source)).digest('hex');
    assert.equal((await call(`/sessions/${sessionId}/turns`, 'alice', 'POST', turn({ source }))).status, 200);
    const stale = { ...source, version: 1 }; stale.sanitizedHash = createHash('sha256').update(approvalPayload(stale)).digest('hex');
    const reply = await call(`/sessions/${sessionId}/turns`, 'alice', 'POST', turn({ source: stale })); assert.equal(reply.status, 409); assert.equal((await reply.json()).code, 'CONTEXT_STALE');
  });
  await t.test('deleting while provider runs prevents late success or resurrection', async () => {
    const started = new Promise(resolve => { signalStarted = resolve; });
    const result = call(`/sessions/${sessionId}/turns`, 'alice', 'POST', turn({ question: 'Wait for cancellation' })); await started;
    assert.equal((await call(`/sessions/${sessionId}`, 'alice', 'DELETE')).status, 204); pendingResolve(model);
    assert.equal((await result).status, 408);
    assert.equal((await call(`/sessions/${sessionId}`)).status, 404);
    assert.equal(await db.collection('messages').countDocuments(), 0);
  });
  await t.test('expiry is checked before Mongo TTL cleanup; preferences reject owner injection', async () => {
    const s = await module.get(Sessions).create('alice');
    await db.collection('sessions').updateOne({ _id: require('../dist/database').objectId(s.id) }, { $set: { expiresAt: new Date(0) } });
    assert.equal((await call(`/sessions/${s.id}`)).status, 404);
    assert.equal((await call('/me', 'alice', 'PATCH', { ownerUid: 'bob' })).status, 400);
    assert.equal((await call('/me', 'alice', 'PATCH', { replyLocale: 'hi-IN', interfaceLocale: 'en-IN' })).status, 200);
    assert.equal((await (await call('/me', 'bob')).json()).replyLocale, 'en-IN');
  });
  await t.test('four keys share atomic budget, cooldown persists across scheduler instances', async () => {
    const quota = module.get(Quota);
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => quota.reserve('gemini', 100)));
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 2);
    const second = new Quota(config, dbProvider);
    await quota.limited(config.slots.sarvam[0], '120');
    await assert.rejects(second.reserve('sarvam', 100), e => e.code === 'PROVIDER_BUSY' && e.retryAfterMs > 60_000);
  });
});
