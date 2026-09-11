import { execFileSync } from 'node:child_process';
export default function teardown() { execFileSync(process.execPath, ['--env-file=.env', 'apps/api/test/cleanup-browser.cjs'], { stdio: 'inherit', windowsHide: true }); }
