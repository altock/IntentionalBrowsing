import { defineConfig } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Playwright configuration for Chrome extension E2E testing.
 *
 * Chrome extensions require special handling:
 * - Must use chromium (not firefox/webkit - they don't support extensions)
 * - Must use persistent context (extensions don't work in incognito/headless)
 * - Extensions are loaded via --load-extension and --disable-extensions-except flags
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
  ],

  // Don't run a web server - we're testing against real sites
  webServer: undefined,
});
