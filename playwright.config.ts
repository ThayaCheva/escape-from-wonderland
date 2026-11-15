import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 240_000,
  // a single click or wait never takes longer than this, so a stale bot move can't hang a test
  use: { baseURL: 'http://localhost:5190', viewport: { width: 1366, height: 768 }, actionTimeout: 5000 },
  webServer: {
    command: 'npm run build && npx tsx server/index.ts',
    env: { PORT: '5190' },
    url: 'http://localhost:5190/health',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
