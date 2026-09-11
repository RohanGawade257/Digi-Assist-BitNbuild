// Real MongoDB + real Nest HTTP. Identity and AI are explicit injected test doubles.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { Test } = require('@nestjs/testing');
const { AppModule, configureHttp } = require('../dist/app');
const { Configuration } = require('../dist/config');
const { IdentityService } = require('../dist/auth');
const { Database } = require('../dist/database');
const { Providers } = require('../dist/providers');
const { Sessions } = require('../dist/sessions');
const { Quota } = require('../dist/quota');
const { ApiError, SafeErrors } = require('../dist/errors');
const { approvalPayload, pcmWave } = require('@guide/contracts');

test('real database ownership, lifecycle, quota concurrency and HTTP boundary', async t => {
  assert.ok(process.env.MONGODB_URI, 'Run setup-local.ps1 and docker compose up -d mongo first');
  const databaseName = `guide_test_${randomUUID().replaceAll('-', '')}`;
  const config = { model: 'fixture', env: { MONGO_DATABASE: databaseName }, mongoUri: process.env.MONGODB_URI, problems: [], slots: { gemini: [1, 2, 3, 4].map(i => ({ secret: `test_${i}`, id: `g_${i}`, group: 'same-project' })), sarvam: [{ secret: 'test_s', id: 's_1', group: 'same-account' }] }, groups: [{ id: 'same-project', provider: 'gemini', rpm: 2, tpm: 1000, rpd: 10 }, { id: 'same-account', provider: 'sarvam', rpm: 2, tpm: 1000, rpd: 10 }] };
  let providerCalls = 0; let pendingResolve; let signalStarted;
  const model = { status: 'answer', explanationEn: 'Read the public instructions.', draftEn: null, referencedLabels: [], requiresFreshContext: false, completionBasis: 'not_completed' };
  let speechCalls = 0, deletedUid = '';
  const wave = pcmWave(new Float32Array(16000).fill(0.1), 16000);
  const provider = { translate: async text => text, transcribe: async () => { speechCalls++; return 'Explain how to attach a file'; }, speak: async () => { speechCalls++; return wave; }, reason: async question => { providerCalls++; if (question === 'Wait for cancellation') { signalStarted(); return new Promise(resolve => { pendingResolve = resolve; }); } return model; } };
  const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(Configuration).useValue(config).overrideProvider(IdentityService).useValue({ configured: true, remove: async uid => { deletedUid = uid; }, verify: async token => { if (!['alice', 'bob', 'unverified', 'old-login'].includes(token)) throw new ApiError('AUTH_REQUIRED', 401); return { uid: token, emailVerified: token !== 'unverified', authTime: token === 'old-login' ? 0 : Date.now() / 1000 }; } }).overrideProvider(Providers).useValue(provider).compile();
  const app = configureHttp(module.createNestApplication({ logger: false, bodyParser: false })); await app.listen(0, '127.0.0.1');
  const dbProvider = module.get(Database); const db = await dbProvider.get();
  t.after(async () => { assert.match(db.databaseName, /^guide_test_[a-f0-9]+$/); await db.dropDatabase(); await app.close(); await dbProvider.onApplicationShutdown(); });
  const base = await app.getUrl();
  async function call(path, token = 'alice', method = 'GET', body) { return fetch(`${base}/api/v1${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); }
  function turn(overrides = {}) { return { requestId: randomUUID(), question: 'Describe a digital task', inputLocale: 'en-IN', replyLocale: 'en-IN', draftLocale: null, taskKind: 'general-help', inputMode: 'text', source: null, nonSensitiveConfirmed: true, ...overrides }; }
  await t.test('public health works, private routes require token and verified email', async () => {
    assert.equal((await call('/health', '')).status, 200);
    for (const route of ['/capabilities', '/me', '/sessions']) assert.equal((await call(route, '')).status, 401);
    assert.equal((await call('/sessions', 'unverified', 'POST', { historyEnabled: false })).status, 403);
    assert.equal((await call('/sessions', 'alice', 'POST', { historyEnabled: 'true' })).status, 400);
  });
  const created = await call('/sessions', 'alice', 'POST', { historyEnabled: false }); assert.equal(created.status, 201); const sessionId = (await created.json()).id;
  await t.test('approved images reject unverified owners, missing consent, stale approval and oversized bodies without persistence', async () => {
    const { imageSource } = require('./image-fixture.cjs');
    const visualSession = await module.get(Sessions).create('alice', true), source = imageSource(2);
    const path = `/sessions/${visualSession.id}/turns`, input = turn({ source });
    assert.equal((await call(path, '', 'POST', input)).status,401);
    assert.equal((await call(path, 'unverified', 'POST', input)).status,403);
    assert.equal((await call(path, 'bob', 'POST', input)).status,404);
    assert.equal((await call(path, 'alice', 'POST', turn({source:{...source,approvedImage:{...source.approvedImage,analysisConsent:false}}}))).status,400);
    assert.equal((await call(path, 'alice', 'POST', turn({source:{...source,version:3}}))).status,400);
    assert.equal((await call(path, 'alice', 'POST', { ...input, padding:'x'.repeat(3*1024*1024) })).status,413);
    assert.equal((await call(path, 'alice', 'POST', input)).status,200);
    assert.equal((await call(path, 'alice', 'POST', turn({source:imageSource(1)}))).status,409);
    for(const name of ['sessions','requestRecords']){
      const rows=await db.collection(name).find({ownerUid:'alice'}).toArray();
      assert.ok(!JSON.stringify(rows).includes(source.approvedImage.data));assert.ok(!JSON.stringify(rows).includes('approvedImage'));
    }
    await module.get(Sessions).close('alice',visualSession.id);
    providerCalls=0;
  });
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
    const counters = await db.collection('quotaAccounts').findOne({ _id: 'same-project' });
    assert.equal(counters.dayRequests, 2); assert.equal(counters.tokens, 200);
    const now = Date.now(), minute = Math.floor(now / 60000) * 60000, day = Math.floor(now / 86400000) * 86400000;
    await db.collection('quotaWindows').insertMany([{ _id: `same-account:60000:${minute}`, requests: 1, tokens: 100 }, { _id: `same-account:86400000:${day}`, requests: 3, tokens: 100 }]);
    await quota.reserve('sarvam', 100);
    const migrated = await db.collection('quotaAccounts').findOne({ _id: 'same-account' }); assert.equal(migrated.dayRequests, 4); assert.equal(migrated.minuteRequests, 2);
    const second = new Quota(config, dbProvider);
    await quota.limited(config.slots.sarvam[0], '120');
    await assert.rejects(second.reserve('sarvam', 100), e => e.code === 'PROVIDER_BUSY' && e.retryAfterMs > 60_000);
  });
  await t.test('Sarvam API buckets are independent while all keys for one API share limits',async()=>{
    const separate={...config,groups:[{id:'same-account',provider:'sarvam',operation:'translate',rpm:2},{id:'same-account',provider:'sarvam',operation:'speak',rpm:1}]};
    // Use a new test-only account to avoid intentional conservative migration of old aggregate spend.
    separate.slots={...config.slots,sarvam:[{id:'sa',secret:'fixture',group:'per-api-test'},{id:'sb',secret:'fixture',group:'per-api-test'}]};
    separate.groups=separate.groups.map(g=>({...g,id:'per-api-test'}));
    const quota=new Quota(separate,dbProvider);
    await quota.reserve('sarvam',50000,'translate');await quota.reserve('sarvam',50000,'translate');
    await assert.rejects(quota.reserve('sarvam',1,'translate'),e=>e.code==='PROVIDER_BUSY');
    const slot=await quota.reserve('sarvam',50000,'speak');assert.equal(slot.operation,'speak');
    await assert.rejects(quota.reserve('sarvam',1,'transcribe'),e=>e.code==='SERVICE_UNAVAILABLE');
    assert.equal((await db.collection('quotaAccounts').findOne({_id:'per-api-test:translate'})).minuteRequests,2);
    assert.equal((await db.collection('quotaAccounts').findOne({_id:'per-api-test:speak'})).minuteRequests,1);
  });
  await t.test('opt-in history survives end, defaults stay volatile, deleting erases embedded content', async () => {
    const session = await module.get(Sessions).create('alice', true); const request = turn();
    assert.equal((await call(`/sessions/${session.id}/turns`, 'alice', 'POST', request)).status, 200);
    const memory = await module.get(Sessions).recent('alice', session.id); assert.equal(memory.length, 1);
    assert.equal((await call(`/sessions/${session.id}/end`, 'alice', 'POST')).status, 204);
    assert.equal((await call(`/sessions/${session.id}/turns`, 'alice', 'POST', turn())).status, 404);
    const saved = await (await call(`/sessions/${session.id}/history`)).json(); assert.equal(saved.turns[0].question, request.question);
    assert.equal((await call(`/sessions/${session.id}/history`, 'bob')).status, 404);
    assert.equal((await call(`/sessions/${session.id}`, 'alice', 'DELETE')).status, 204);
    assert.equal((await call(`/sessions/${session.id}/history`)).status, 404);
    const record = await db.collection('sessions').findOne({ _id: require('../dist/database').objectId(session.id) }); assert.equal(record.turns, undefined);
  });
  await t.test('WAV speech requires consent, rejects silence, deduplicates and TTS uses only owned answers', async () => {
    const s = await module.get(Sessions).create('alice');
    async function transcribe(bytes, metadata, token = 'alice', field = 'metadata') {
      const form = new FormData(); form.set('file', new Blob([bytes], { type: 'audio/wav' }), 'synthetic.wav'); form.set(field, JSON.stringify(metadata));
      return fetch(`${base}/api/v1/sessions/${s.id}/transcriptions`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
    }
    const metadata = { requestId: randomUUID(), inputLocale: 'hi-IN', cloudSpeechConsent: true };
    config.strictPrivacy = true; assert.equal((await transcribe(wave, metadata)).status, 403); config.strictPrivacy = false;
    assert.equal((await transcribe(wave, { ...metadata, cloudSpeechConsent: false })).status, 400);
    assert.equal((await transcribe(wave, metadata, 'alice', 'metadata[0]')).status, 400);
    assert.equal((await transcribe(wave, metadata, 'alice', 'metadata[999999999]')).status, 400);
    assert.equal((await transcribe(wave, metadata, 'bob')).status, 404);
    assert.equal((await transcribe(pcmWave(new Float32Array(16000), 16000), metadata)).status, 422);
    assert.equal(speechCalls, 0);
    assert.equal((await transcribe(wave, metadata)).status, 200);
    assert.equal((await transcribe(wave, metadata)).status, 409); assert.equal(speechCalls, 1);
    const request = turn(); await call(`/sessions/${s.id}/turns`, 'alice', 'POST', request);
    const audioPath = `/sessions/${s.id}/turns/${request.requestId}/audio`;
    const body = { segment: 'explanation', chunk: 0, pace: 1 };
    assert.equal((await call(audioPath, 'bob', 'POST', body)).status, 404);
    assert.equal((await call(audioPath, 'alice', 'POST', { ...body, text: 'Arbitrary text' })).status, 400);
    const audio = await call(audioPath, 'alice', 'POST', body); assert.equal(audio.status, 200); assert.match(audio.headers.get('content-type'), /audio\/wav/); assert.deepEqual(new Uint8Array(await audio.arrayBuffer()), wave);
    await call(`/sessions/${s.id}`, 'alice', 'DELETE'); assert.equal((await call(audioPath, 'alice', 'POST', body)).status, 404);
  });
  await t.test('feedback is explicit and account deletion blocks future writes and requires recent authentication', async () => {
    const s = await module.get(Sessions).create('alice');
    const feedback = { sessionId: s.id, rating: 'helpful', locale: 'en-IN', text: 'Clear instructions', saveConsent: true };
    assert.equal((await call('/feedback', 'alice', 'POST', { ...feedback, saveConsent: false })).status, 400);
    assert.equal((await call('/feedback', 'bob', 'POST', feedback)).status, 404);
    assert.equal((await call('/feedback', 'alice', 'POST', feedback)).status, 204);
    assert.equal((await call(`/sessions/${s.id}/end`, 'alice', 'POST')).status, 204);
    assert.equal((await call('/feedback', 'alice', 'POST', feedback)).status, 404);
    assert.equal((await call('/feedback', 'alice', 'POST', { ...feedback, sessionId: null, saveConsent: false })).status, 400);
    assert.equal((await call('/feedback', 'alice', 'POST', { ...feedback, sessionId: null })).status, 204);
    assert.equal((await call('/me', 'old-login', 'DELETE')).status, 401);
    assert.equal((await call('/me', 'alice', 'DELETE')).status, 204); assert.equal(deletedUid, 'alice');
    for (const collection of ['sessions', 'requestRecords', 'feedback']) assert.equal(await db.collection(collection).countDocuments({ ownerUid: 'alice' }), 0);
    assert.equal((await call('/sessions', 'alice', 'POST', { historyEnabled: false })).status, 403);
    assert.equal((await call('/me', 'alice', 'PATCH', { audioEnabled: true })).status, 403);
    assert.equal((await call('/feedback', 'alice', 'POST', { ...feedback, sessionId: null })).status, 403);
  });
});
