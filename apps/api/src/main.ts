import { createApp } from './app';
import { Configuration } from './config';
async function main() { const app = await createApp(); await app.listen(app.get(Configuration).port, '0.0.0.0'); console.log('Digital Assistant API started. See /api/v1/ready for readiness.'); }
main().catch(() => { console.error('API startup failed. Check configuration and port availability.'); process.exitCode = 1; });
