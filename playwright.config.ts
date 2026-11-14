import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 180_000,
  use: { baseURL: 'http://localhost:5180', viewport: { width: 1366, height: 768 } },
  webServer: { command: 'npx vite --port 5180 --strictPort', url: 'http://localhost:5180', reuseExistingServer: true },
});
