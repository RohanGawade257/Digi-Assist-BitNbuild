import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests/browser', fullyParallel: true, workers: 2, retries: 0, reporter: 'list', use: { baseURL: 'http://127.0.0.1:3000', trace: 'retain-on-failure' }, webServer: { command: 'pnpm --filter @guide/web start', url: 'http://127.0.0.1:3000', reuseExistingServer: !process.env.CI, timeout: 60000 } });
