const { MongoClient } = require('mongodb');
const fs = require('node:fs');
async function main() {
  const manifest = 'test-results/browser-database.json';
  if (!fs.existsSync(manifest)) return;
  const { name } = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  if (!/^guide_test_[a-f0-9]{32}$/.test(name)) throw new Error('Unsafe test database name');
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 2500 });
  try { await client.connect(); await client.db(name).dropDatabase(); fs.unlinkSync(manifest); console.log('Current browser fixture database removed.'); }
  finally { await client.close(); }
}
main().catch(() => { console.error('Browser fixture cleanup failed; see the test-results database manifest.'); process.exitCode = 1; });
