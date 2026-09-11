const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { z } = createRequire(path.resolve('packages/contracts/package.json'))('zod');
const contracts = require('../packages/contracts/dist/index.js');
const definitions = { Turn: contracts.turnSchema, Answer: contracts.answerSchema, Source: contracts.sourceSchema, PreferencesPatch: contracts.preferencesSchema.partial(), Preferences: contracts.preferencesSchema, NewSession: contracts.newSessionSchema, SpeechMetadata: contracts.transcriptionSchema, AudioRequest: contracts.audioRequestSchema, Feedback: contracts.feedbackSchema };
const schemas = Object.fromEntries(Object.entries(definitions).map(([key, value]) => [key, z.toJSONSchema(value, { target: 'draft-2020-12', io: 'input' })]));
const paths = {};
function route(url, method, summary, input, output, status = '200', extra = {}) {
  const parameters = [...url.matchAll(/\{(\w+)\}/g)].map(([, name]) => ({ in: 'path', name, required: true, schema: { type: 'string' } }));
  paths[url] ||= {}; paths[url][method] = { summary, ...(parameters.length ? { parameters } : {}), ...(input ? { requestBody: { required: true, content: { 'application/json': { schema: { $ref: `#/components/schemas/${input}` } } } } } : {}), responses: { [status]: { description: 'Success', ...(output ? { content: { 'application/json': { schema: { $ref: `#/components/schemas/${output}` } } } } : {}) }, default: { description: 'Safe error; code, messageKey, requestId and optional retryAfterMs. See docs/api.md.' } }, ...extra };
}
route('/health', 'get', 'Liveness', null, null, '200', { security: [] });
route('/ready', 'get', 'Local configuration, identity file and Mongo readiness; no live generation probe', null, null, '200', { security: [] });
route('/capabilities', 'get', 'Configured and explicitly unverified provider capabilities');
route('/me', 'get', 'Owner preferences', null, 'Preferences'); route('/me', 'patch', 'Update strict owner preferences', 'PreferencesPatch', 'Preferences'); route('/me', 'delete', 'Recent-login account deletion; retryable provider failure leaves local tombstone', null, null, '204');
route('/sessions', 'post', 'Create verified-user session with explicit history setting', 'NewSession', null, '201'); route('/sessions', 'get', 'List last 50 non-expired saved sessions');
route('/sessions/{id}', 'get', 'Owner and idle-expiry checked session metadata'); route('/sessions/{id}', 'delete', 'Delete saved or active session and discard late results', null, null, '204');
route('/sessions/{id}/history', 'get', 'Owner and retention checked saved text'); route('/sessions/{id}/end', 'post', 'End session; preserve explicitly saved history only', null, null, '204');
route('/sessions/{id}/turns', 'post', 'Bounded synchronous typed/voice-reviewed turn', 'Turn', 'Answer'); route('/sessions/{id}/turns/{requestId}/cancel', 'post', 'Cancel active turn', null, null, '204');
route('/sessions/{id}/transcriptions', 'post', 'Explicitly consented PCM16 WAV input, at most 25 seconds and 3 MiB', null, null, '200', { requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', additionalProperties: false, required: ['file', 'metadata'], properties: { file: { type: 'string', format: 'binary' }, metadata: { type: 'string', description: 'JSON-encoded SpeechMetadata. Raw audio is sent before transcript review.' } } } } } } });
route('/sessions/{id}/turns/{requestId}/audio', 'post', 'Read a server-owned answer chunk; Urdu output unavailable', 'AudioRequest', null, '200'); paths['/sessions/{id}/turns/{requestId}/audio'].post.responses['200'] = { description: 'PCM WAV', content: { 'audio/wav': { schema: { type: 'string', format: 'binary' } } } };
route('/sessions/{id}/speech/cancel', 'post', 'Cancel active speech operation', null, null, '204'); route('/feedback', 'post', 'Explicitly consented feedback; 90-day retention', 'Feedback', null, '204');
const document = { openapi: '3.1.0', info: { title: 'Digital Assistant', version: '0.2.0', description: 'Implemented API. Source hash, target membership, freshness, privacy, quota and ownership checks run in code in addition to these JSON schemas. Approved PNG image analysis uses the authenticated turn route. No automatic raw image uploads, remote fetch, SSE or external-action routes.' }, servers: [{ url: 'http://localhost:3001/api/v1' }], security: [{ firebase: [] }], paths, components: { securitySchemes: { firebase: { type: 'http', scheme: 'bearer', bearerFormat: 'Firebase ID token' } }, schemas } };
const json = JSON.stringify(document, null, 2) + '\n';
if (process.argv.includes('--check')) { if (fs.readFileSync('docs/openapi.json', 'utf8') !== json) throw new Error('OpenAPI is stale; run pnpm docs:api'); }
else fs.writeFileSync('docs/openapi.json', json);
console.log('OpenAPI contracts are current.');
