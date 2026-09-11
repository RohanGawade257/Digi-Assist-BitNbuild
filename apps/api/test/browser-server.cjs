// Test-only Nest/Mongo server. Never imported by production entry points.
const { Test } = require('@nestjs/testing');
const { randomUUID } = require('node:crypto');
const { AppModule, configureHttp } = require('../dist/app');
const { Configuration } = require('../dist/config');
const { IdentityService } = require('../dist/auth');
const { Providers } = require('../dist/providers');
const { Database } = require('../dist/database');
const { SafeErrors, ApiError } = require('../dist/errors');
const { pcmWave } = require('@guide/contracts');
async function main() {
  const name = `guide_test_${randomUUID().replaceAll('-', '')}`;
  const fs = require('node:fs'); fs.mkdirSync('../../test-results', { recursive: true }); fs.writeFileSync('../../test-results/browser-database.json', JSON.stringify({ name }));
  const configuration = { env: { MONGO_DATABASE: name }, mongoUri: process.env.MONGODB_URI, problems: [], model: 'fixture', slots: { gemini: [{group:'g',id:'g',secret:'fixture'}], sarvam: [{group:'s',id:'s',secret:'fixture'}] }, groups: [{id:'g',provider:'gemini',rpm:100,tpm:10000000,rpd:10000},{id:'s',provider:'sarvam',rpm:100,tpm:10000000,rpd:10000}], strictPrivacy: false };
  const words = { 'en-IN': 'Read the public instructions.', 'hi-IN': 'सार्वजनिक निर्देश पढ़ें।', 'bn-IN': 'প্রকাশ্য নির্দেশ পড়ুন।', 'mr-IN': 'सार्वजनिक सूचना वाचा.', 'te-IN': 'బహిరంగ సూచనలను చదవండి.', 'ta-IN': 'பொது வழிமுறைகளைப் படிக்கவும்.', 'ur-IN': 'عوامی ہدایات پڑھیں۔' };
  const wave = pcmWave(Float32Array.from({ length: 16000 }, (_, i) => Math.sin(i / 20) * 0.1), 16000);
  const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(Configuration).useValue(configuration).overrideProvider(IdentityService).useValue({ configured: true, remove: async () => {}, verify: async token => { if (!/^browser-[a-f0-9-]+$/.test(token)) throw new ApiError('AUTH_REQUIRED', 401); return { uid: token, emailVerified: true, authTime: Date.now() / 1000 }; } }).overrideProvider(Providers).useValue({
    translate: async (text, from, to) => from === to ? text : words[to],
    reason: async (question, turn, signal) => {
      if (question.includes('Wait')) await new Promise((resolve, reject) => { const timer = setTimeout(resolve, 3000); signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('Canceled')); }, { once: true }); });
      return { status: 'answer', explanationEn: words['en-IN'], draftEn: turn.taskKind === 'draft-text' ? 'Dear [recipient],\nPlease send the public registration instructions.\nThank you.' : null, referencedLabels: [], requiresFreshContext: false, completionBasis: 'not_completed' };
    }, transcribe: async () => 'Explain the public registration instructions', speak: async () => wave
  }).compile();
  const app = configureHttp(module.createNestApplication({ logger: false, bodyParser: false })); await app.listen(4101, '127.0.0.1');
  let closing = false;
  const close = async () => { if (closing) return; closing = true; const db = await module.get(Database).get(); if (!/^guide_test_[a-f0-9]+$/.test(db.databaseName)) throw new Error('Unsafe test DB'); await db.dropDatabase(); await app.close(); await module.get(Database).onApplicationShutdown(); process.exit(0); };
  process.on('SIGINT', close); process.on('SIGTERM', close);
  console.log('Isolated browser fixture API ready on 4101; real Mongo, injected identity/provider doubles.');
}
main().catch(() => { console.error('Browser fixture API failed. Check local Mongo setup.'); process.exit(1); });
