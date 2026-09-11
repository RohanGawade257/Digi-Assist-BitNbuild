const { test } = require('node:test');
const assert = require('node:assert/strict');
const { protectLabels, inspectWave, pcmWave, splitText, containsSensitiveText, imageDimensions } = require('@guide/contracts');
const { readBounded } = require('../dist/transport');
const { Providers } = require('../dist/providers');

test('short, repeated and overlapping labels survive a single replacement pass', () => {
  const input = 'Choose Attach files, then A, _ and Attach files.';
  const protectedText = protectLabels(input, ['Attach files', 'Attach', 'A', '_']);
  assert.equal(protectedText.restore(protectedText.text), input);
  assert.throws(() => protectedText.restore(protectedText.text + '__GUIDE_LABEL_0__'));
  assert.throws(() => protectedText.restore(protectedText.text.replace('__GUIDE_LABEL_0__', '__GUIDE_LABEL_99__')));
  assert.throws(() => protectLabels('__GUIDE_LABEL_1__', ['A']));
});
test('oversized streams are canceled while being read; abort also interrupts a stalled body', async () => {
  let canceled = false;
  const stream = new ReadableStream({ pull(c) { c.enqueue(new Uint8Array(64)); }, cancel() { canceled = true; } });
  await assert.rejects(readBounded(new Response(stream), 100, new AbortController().signal), e => e.code === 'PROVIDER_INVALID_RESPONSE');
  assert.equal(canceled, true);
  const controller = new AbortController();
  const pending = readBounded(new Response(new ReadableStream()), 100, controller.signal);
  controller.abort(); await assert.rejects(pending);
});
test('401 retries a replacement once; 403 and 429 cannot rotate keys', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  let calls = 0, disabled = 0;
  const p = new Providers({}, { scheduled: async () => ({ secret: 'fixture' }), disable: () => disabled++, limited: async () => {} });
  global.fetch = async () => { calls++; return calls === 1 ? new Response('', { status: 401 }) : Response.json({ translated_text: 'translated' }); };
  assert.equal(await p.translate('hello', 'en-IN', 'hi-IN', [], new AbortController().signal), 'translated');
  assert.equal(disabled, 1); assert.equal(calls, 2);
  for (const status of [403, 429]) {
    calls = 0; global.fetch = async () => { calls++; return new Response('', { status }); };
    await assert.rejects(p.translate('hello', 'en-IN', 'hi-IN', [], new AbortController().signal)); assert.equal(calls, 1);
  }
});
test('audio duration comes from validated PCM bytes, with malformed headers rejected', () => {
  const bytes = pcmWave(new Float32Array(16000).fill(0.1), 16000);
  assert.equal(inspectWave(bytes).seconds, 1);
  assert.throws(() => inspectWave(bytes.subarray(0, bytes.length - 2)));
  const corrupt = bytes.slice(); new DataView(corrupt.buffer).setUint32(28, 1, true); assert.throws(() => inspectWave(corrupt));
  assert.throws(() => inspectWave(pcmWave(new Float32Array(16000 * 26), 16000)));
});

test('upstream timeouts use 504 so browsers do not replay a billed POST as an incomplete request', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  global.fetch = async () => { throw new DOMException('Upstream deadline', 'TimeoutError'); };
  const provider = new Providers({}, { scheduled: async () => ({ secret: 'fixture' }) });
  await assert.rejects(provider.translate('Hello', 'en-IN', 'hi-IN', [], new AbortController().signal), error => error.code === 'TURN_TIMEOUT' && error.getStatus() === 504);
});
test('Unicode speech chunks preserve the entire text and regional digits trigger privacy review', () => {
  const text = 'हिन्दी বাংলা తెలుగు தமிழ் اردو 🙂. '.repeat(200);
  const chunks = splitText(text); assert.equal(chunks.join(''), text); assert.ok(chunks.every(c => c.length <= 1800 && !/[\ud800-\udbff]$/.test(c)));
  for (const input of ['१२३४ ५६७८ ९०१२', '۱۲۳۴۵۶۷۸۹۰', '১২৩৪৫৬৭৮৯০']) assert.equal(containsSensitiveText(input), true);
  assert.ok(splitText('x'.repeat(1799) + '. ' + 'y'.repeat(100)).every(chunk => chunk.length <= 1800));
});
test('unsupported Urdu output fails before any quota debit', async () => {
  const provider = new Providers({}, { scheduled: () => { throw new Error('must not bill'); } });
  await assert.rejects(provider.speak('اردو', 'ur-IN', 1, new AbortController().signal), error => error.code === 'SPEECH_LANGUAGE_UNAVAILABLE');
});
test('image dimensions reject compressed oversized previews before bitmap allocation', () => {
  const png = new Uint8Array(24); png.set([137, 80, 78, 71], 0); png.set(Buffer.from('IHDR'), 12);
  const view = new DataView(png.buffer); view.setUint32(16, 640); view.setUint32(20, 360); assert.deepEqual(imageDimensions(png, 'image/png'), { width: 640, height: 360 });
  view.setUint32(16, 100000); assert.throws(() => imageDimensions(png, 'image/png'));
  assert.throws(() => imageDimensions(Buffer.from('<svg/>'), 'image/webp'));
});
test('Sarvam WAV array parts preserve all audio instead of stopping at base64 padding', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  const first = pcmWave(new Float32Array(16000).fill(0.1), 16000), second = pcmWave(new Float32Array(8000).fill(0.2), 16000);
  global.fetch = async () => Response.json({ audios: [Buffer.from(first).toString('base64'), Buffer.from(second).toString('base64')] });
  const provider = new Providers({}, { scheduled: async () => ({ secret: 'fixture' }) });
  const audio = await provider.speak('A short synthetic answer', 'en-IN', 1, new AbortController().signal);
  assert.equal(inspectWave(audio).seconds, 1.5);
});
