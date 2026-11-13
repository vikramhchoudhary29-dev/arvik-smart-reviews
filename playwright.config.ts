import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  use: {
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    baseURL: 'http://localhost:4317',
    viewport: { width: 390, height: 844 },
  },
  webServer: [
    {
      command: 'npx tsx tests/browser-server.ts',
      url: 'http://localhost:4317',
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command: 'npx tsx tests/analytics-browser-server.ts',
      url: 'http://127.0.0.1:4318',
      reuseExistingServer: false,
      timeout: 60000,
    },
  ],
  reporter: [['list'], ['json', { outputFile: 'test-results/browser-results.json' }]],
});
