import { defineConfig } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Playwright configuration for browser extension E2E testing.
 *
 * Chrome extensions require special handling:
 * - Must use chromium (not firefox/webkit - they don't support extensions)
 * - Must use persistent context (extensions don't work in incognito/headless)
 * - Extensions are loaded via --load-extension and --disable-extensions-except flags
 *
 * Firefox extensions:
 * - Use playwright-webextext library for loading add-ons
 * - Also require persistent context and headed mode
 * - Tests are in separate file (firefox.spec.ts) due to different fixture setup
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Extensions need sequential tests due to shared browser state
  forbidOnly: !!process.env.CI,
  retries: 2, // Retry flaky network tests against real sites
  workers: 1, // Single worker for extension testing
  reporter: 'html',
  timeout: 60000, // Longer timeout for network requests to real sites
  globalTimeout: 5 * 60 * 1000, // 5 minute global timeout

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium-extension',
      testMatch: 'extension.spec.ts',
      use: {
        // Chrome extensions don't work in headless mode
        headless: false,
        // Use chromium channel for better extension support
        channel: 'chromium',
        // Viewport settings
        viewport: { width: 1280, height: 720 },
        // Extension-specific launch options are handled in the test fixtures
      },
    },
    {
      name: 'firefox-extension',
      testMatch: 'firefox.spec.ts',
      use: {
        // Specify Firefox as the browser
        browserName: 'firefox',
        // Firefox extensions don't work in headless mode
        headless: false,
        // Viewport settings
        viewport: { width: 1280, height: 720 },
        // Extension loading is handled via playwright-webextext in the test file
      },
    },
  ],

  // Don't run a web server - we're testing against real sites
  webServer: undefined,
});
