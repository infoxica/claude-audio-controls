import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', timeout: 30000, workers: 1,
  use: { browserName: 'chromium', headless: true, launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] } },
  reporter: [['list']], outputDir: 'build/test-results',
});
