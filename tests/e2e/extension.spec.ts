import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * E2E tests for the Intentional Browsing Chrome extension.
 *
 * These tests verify:
 * - Extension loads successfully in Chrome
 * - Blocked URLs (twitter.com) redirect to the extension's blocked page
 * - Allowed URLs (twitter.com/messages) work without interference
 * - Extension popup opens and displays correctly
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionPath = path.resolve(__dirname, '../../dist/chrome');

// Helper to get extension ID from the service worker
async function getExtensionId(context: BrowserContext): Promise<string> {
  // Wait a moment for extension to initialize
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Check existing service workers
  let workers = context.serviceWorkers();

  // If no workers yet, wait for one to appear
  if (workers.length === 0) {
    // Create a page to trigger extension activation
    const page = await context.newPage();
    await page.goto('about:blank');
    await page.waitForTimeout(1000);
    await page.close();

    workers = context.serviceWorkers();
  }

  // Still no workers, wait for the event
  if (workers.length === 0) {
    try {
      const worker = await context.waitForEvent('serviceworker', { timeout: 10000 });
      workers = [worker];
    } catch {
      // Fallback: workers might not be detectable, but extension could still work
      console.log('No service workers detected, continuing with tests...');
    }
  }

  // Extract extension ID from service worker URL
  for (const worker of workers) {
    const url = worker.url();
    const match = url.match(/chrome-extension:\/\/([a-z]+)/);
    if (match) {
      return match[1];
    }
  }

  // If we can't find the extension ID, return empty string
  // Tests will handle this gracefully
  return '';
}

// Create a persistent browser context with the extension loaded
async function createExtensionContext(): Promise<BrowserContext> {
  // Chrome extensions require a persistent context (not incognito)
  // and must be run in headed mode (not headless)
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      // Disable various Chrome features that may interfere with testing
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-default-apps',
      '--disable-popup-blocking',
      '--disable-translate',
      '--disable-sync',
      '--disable-background-timer-throttling',
      // Allow running without sandbox in CI environments
      ...(process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox'] : []),
    ],
    viewport: { width: 1280, height: 720 },
  });

  return context;
}

/**
 * Navigate to a URL with retry logic for flaky network connections.
 * Twitter/X sometimes aborts connections or closes pages unexpectedly.
 */
async function safeNavigate(page: Page, url: string): Promise<void> {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (e) {
    // If navigation was aborted (common with Twitter), wait and continue
    // The page might still be usable
    await page.waitForTimeout(2000);
  }
}

/**
 * Check whether a URL is this extension's blocked page.
 */
function isBlockedExtensionPage(url: string, extensionId: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'chrome-extension:' &&
      parsed.host === extensionId &&
      parsed.pathname === '/ui/blocked.html';
  } catch {
    return false;
  }
}

function isTwitterOrXPage(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === 'twitter.com' || host.endsWith('.twitter.com') ||
      host === 'x.com' || host.endsWith('.x.com');
  } catch {
    return false;
  }
}

test.describe('Intentional Browsing Extension', () => {
  let context: BrowserContext;
  let extensionId: string;

  test.beforeAll(async () => {
    context = await createExtensionContext();
    extensionId = await getExtensionId(context);

    if (extensionId) {
      console.log(`Extension loaded with ID: ${extensionId}`);
    } else {
      console.log('Extension ID not detected, popup tests may be skipped');
    }
  });

  test.afterAll(async () => {
    if (context) {
      await context.close();
    }
  });

  test('extension loads and redirects work', async () => {
    // This is a combined test to verify extension is working
    // by checking that twitter.com redirects to the blocked page.
    const page = await context.newPage();

    // Navigate to twitter.com (blocked by extension rules)
    // The extension should redirect to its blocked page.
    await safeNavigate(page, 'https://twitter.com/');

    // Wait for potential redirect
    await page.waitForTimeout(3000);

    // Verify we were redirected to the extension's blocked page.
    const url = page.url();
    expect(isBlockedExtensionPage(url, extensionId)).toBe(true);

    await page.close();
  });

  test('twitter.com/home redirects to the blocked page', async () => {
    const page = await context.newPage();

    // Navigate to twitter.com/home (blocked by extension rules)
    await safeNavigate(page, 'https://twitter.com/home');

    // Wait for potential redirect
    await page.waitForTimeout(3000);

    // Verify we were redirected to the extension's blocked page.
    const url = page.url();
    expect(isBlockedExtensionPage(url, extensionId)).toBe(true);

    await page.close();
  });

  test('twitter.com/explore remains allowed', async () => {
    const page = await context.newPage();

    // Explore is intentionally allowed by the extension rules.
    await safeNavigate(page, 'https://twitter.com/explore');

    // Wait for potential redirect
    await page.waitForTimeout(3000);

    // Twitter may ask for login, but the extension must not block this route.
    const url = page.url();
    expect(isTwitterOrXPage(url)).toBe(true);
    expect(isBlockedExtensionPage(url, extensionId)).toBe(false);

    await page.close();
  });

  test('twitter.com/messages is allowed without redirect', async () => {
    const page = await context.newPage();

    // Navigate to twitter.com/messages (allowed by extension rules)
    await safeNavigate(page, 'https://twitter.com/messages');

    // Wait to ensure no redirect happens
    await page.waitForTimeout(3000);

    // Verify the extension did not redirect this allowed route to its blocked page.
    const url = page.url();
    expect(isTwitterOrXPage(url)).toBe(true);
    expect(isBlockedExtensionPage(url, extensionId)).toBe(false);

    await page.close();
  });

  test('twitter.com/username profile pages are allowed', async () => {
    const page = await context.newPage();

    // Navigate to a profile page (allowed by extension rules)
    // Using a known public account
    await safeNavigate(page, 'https://twitter.com/elonmusk');

    // Wait to ensure no redirect happens
    await page.waitForTimeout(3000);

    // Verify we stayed on the profile page (or were redirected to x.com equivalent)
    // Profile pages should NOT be redirected to /messages
    const url = page.url();
    expect(url).toMatch(/(?:twitter|x)\.com\/elonmusk/i);

    await page.close();
  });

  test('extension popup opens and displays UI', async () => {
    // Skip if we couldn't detect extension ID
    test.skip(!extensionId, 'Extension ID not available for popup test');

    // Open the extension popup
    const popupUrl = `chrome-extension://${extensionId}/ui/popup.html`;
    const page = await context.newPage();
    await page.goto(popupUrl);

    // Wait for popup content to load
    await page.waitForSelector('.popup', { timeout: 5000 });

    // Verify popup title is present
    const title = await page.locator('.title').textContent();
    expect(title).toBe('Intentional Browsing');

    // Verify global toggle exists (the checkbox may be visually hidden but should exist in DOM)
    const globalToggle = page.locator('#global-enabled');
    await expect(globalToggle).toHaveCount(1);

    // Verify the enabled platform controls render from stored configuration.
    const platformToggles = page.locator('.platform-toggle');
    await expect(platformToggles).toHaveCount(6);

    // Verify platforms section exists
    const platforms = page.locator('#platforms');
    await expect(platforms).toBeVisible();

    await page.close();
  });

  test('extension popup global toggle is functional', async () => {
    // Skip if we couldn't detect extension ID
    test.skip(!extensionId, 'Extension ID not available for popup test');

    const popupUrl = `chrome-extension://${extensionId}/ui/popup.html`;
    const page = await context.newPage();
    await page.goto(popupUrl);

    await page.waitForSelector('.popup', { timeout: 5000 });

    // Get the global toggle (checkbox input)
    const globalToggle = page.locator('#global-enabled');

    // Check initial state (should be checked/enabled by default)
    const initialState = await globalToggle.isChecked();
    expect(initialState).toBe(true);

    // Click on the toggle's label/slider instead of the hidden checkbox
    // The toggle slider is the visible clickable element
    const toggleLabel = page.locator('.global-toggle');
    await toggleLabel.click();
    await page.waitForTimeout(500);

    // Verify it's now unchecked
    const newState = await globalToggle.isChecked();
    expect(newState).toBe(false);

    // Toggle back on for subsequent tests
    await toggleLabel.click();
    await page.waitForTimeout(500);

    // Verify it's back to checked
    const restoredState = await globalToggle.isChecked();
    expect(restoredState).toBe(true);

    await page.close();
  });

  test('popup setting changes update an already-open soft-blocked page', async () => {
    test.skip(!extensionId, 'Extension ID not available for popup test');

    await context.route('https://www.youtube.com/**', async route => {
      await route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><body>
          <input aria-label="Search">
          <ytd-rich-grid-renderer><div>Recommendation feed</div></ytd-rich-grid-renderer>
        </body></html>`,
      });
    });

    const youtubePage = await context.newPage();
    const popupPage = await context.newPage();

    try {
      await youtubePage.goto('https://www.youtube.com/');
      const feed = youtubePage.locator('ytd-rich-grid-renderer');
      await expect(feed).toBeHidden({ timeout: 5000 });

      await popupPage.goto(`chrome-extension://${extensionId}/ui/popup.html`);
      const youtubeToggle = popupPage.locator(
        '.platform[data-platform="youtube"] input[type="checkbox"]'
      );
      await expect(youtubeToggle).toBeChecked();

      await popupPage.locator(
        '.platform[data-platform="youtube"] .platform-toggle'
      ).click();
      await expect(feed).toBeVisible({ timeout: 5000 });

      await popupPage.locator(
        '.platform[data-platform="youtube"] .platform-toggle'
      ).click();
      await expect(feed).toBeHidden({ timeout: 5000 });
    } finally {
      await popupPage.close();
      await youtubePage.close();
      await context.unroute('https://www.youtube.com/**');
    }
  });
  test('YouTube navigation and delayed rule synchronization preserve blocking', async () => {
    expect(extensionId).toBeTruthy();
    const worker = context.serviceWorkers()[0];
    const popup = await context.newPage();
    const page = await context.newPage();
    await context.route('https://www.youtube.com/**', route => route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html><body><main></main><aside id="related">Recommendations</aside></body></html>',
    }));
    await popup.goto(`chrome-extension://${extensionId}/ui/popup.html`);
    const originalConfig = await popup.evaluate(async () => {
      const response = await chrome.runtime.sendMessage({ type: 'GET_CONFIG' });
      return response.data;
    });
    try {
      await page.goto('https://www.youtube.com/watch?v=initial');
      // Hidden watch-page recommendations confirm that content-script initialization finished.
      await expect(page.locator('#related')).toBeHidden();
      for (let visit = 0; visit < 2; visit++) {
        await page.evaluate(() => {
          history.pushState({}, '', '/');
          document.dispatchEvent(new Event('yt-navigate-finish'));
        });
        await page.evaluate(() => {
          document.querySelector('main')!.innerHTML = '<ytd-rich-grid-renderer>Home feed</ytd-rich-grid-renderer>';
        });
        await expect(page.locator('ytd-rich-grid-renderer')).toBeHidden();
        await page.evaluate(() => {
          history.pushState({}, '', '/watch?v=next');
          document.dispatchEvent(new Event('yt-navigate-finish'));
          document.querySelector('main')!.innerHTML = '<ytd-rich-grid-renderer>Watch grid</ytd-rich-grid-renderer>';
        });
        // Cross two animation frames to let any stale observer callback run.
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await expect(page.locator('ytd-rich-grid-renderer')).toBeVisible();
      }
      await popup.evaluate(async () => {
        await chrome.runtime.sendMessage({ type: 'UPDATE_CONFIG', payload: {
          kind: 'platform-enabled', platformId: 'youtube', enabled: false,
        } });
        await chrome.runtime.sendMessage({ type: 'UPDATE_CONFIG', payload: {
          kind: 'platform-redirect-target', platformId: 'youtube', redirectTarget: 'blocked',
        } });
      });
      await popup.reload();
      await page.goto('https://www.youtube.com/');
      const timeOrigin = await page.evaluate(() => performance.timeOrigin);
      await worker.evaluate(() => {
        const state = globalThis as any;
        state.originalUpdateRules = chrome.declarativeNetRequest.updateDynamicRules.bind(chrome.declarativeNetRequest);
        chrome.declarativeNetRequest.updateDynamicRules = async options => {
          await new Promise(resolve => { state.releaseRules = resolve; });
          return state.originalUpdateRules(options);
        };
      });
      await popup.locator('.platform[data-platform="youtube"] .platform-toggle').click();
      await expect.poll(() => worker.evaluate(() => typeof (globalThis as any).releaseRules)).toBe('function');
      // Give the content script time to receive storage.onChanged while rule application is held.
      await page.waitForTimeout(200);
      expect(page.url()).toBe('https://www.youtube.com/');
      expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
      await worker.evaluate(() => {
        const state = globalThis as any;
        chrome.declarativeNetRequest.updateDynamicRules = state.originalUpdateRules;
        state.releaseRules();
        delete state.releaseRules;
      });
      await expect(page).toHaveURL(`chrome-extension://${extensionId}/ui/blocked.html`);
    } finally {
      await worker.evaluate(() => {
        const state = globalThis as any;
        if (state.originalUpdateRules) chrome.declarativeNetRequest.updateDynamicRules = state.originalUpdateRules;
        state.releaseRules?.();
        delete state.originalUpdateRules;
        delete state.releaseRules;
      });
      await page.close();
      await popup.evaluate(async config => {
        const response = await chrome.runtime.sendMessage({ type: 'SET_CONFIG', payload: config });
        if (!response.success) throw new Error(response.error);
      }, originalConfig);
      await popup.close();
      await context.unroute('https://www.youtube.com/**');
    }
  });

  test('alternative redirects respect disabled surfaces and nested Reddit feeds', async () => {
    const popup = await context.newPage();
    const page = await context.newPage();
    const destination = 'https://example.org/intentional-review';
    await context.route('https://example.org/**', route => route.fulfill({
      contentType: 'text/html', body: '<h1>Alternative page</h1>',
    }));
    const sourceFixture = (route: import('@playwright/test').Route) => route.fulfill({
      contentType: 'text/html', body: '<h1>Allowed surface</h1><aside id="related">Recommendations</aside>',
    });
    await context.route('https://www.youtube.com/**', sourceFixture);
    await context.route('https://www.reddit.com/**', sourceFixture);
    await popup.goto(`chrome-extension://${extensionId}/ui/popup.html`);
    const originalConfig = await popup.evaluate(async () => (await chrome.runtime.sendMessage({ type: 'GET_CONFIG' })).data);
    try {
      for (const [platformId, source, setting] of [
        ['youtube', 'https://www.youtube.com/shorts/abc', 'shorts'],
        ['reddit', 'https://www.reddit.com/home/nested?sort=top', 'home'],
        ['reddit', 'https://www.reddit.com/all/nested', 'all'],
      ]) {
        for (const enabled of [true, false, true]) {
          await popup.evaluate(async ({ platformId, setting, enabled, destination }) => {
            const config = (await chrome.runtime.sendMessage({ type: 'GET_CONFIG' })).data;
            config.platforms[platformId].enabled = true;
            config.platforms[platformId].redirectTarget = 'custom';
            config.platforms[platformId].customSettings = { alternativeUrl: destination };
            config.platforms[platformId].hardBlocks[setting] = enabled;
            const response = await chrome.runtime.sendMessage({ type: 'SET_CONFIG', payload: config });
            if (!response.success) throw new Error(response.error);
          }, { platformId, setting, enabled, destination });
          await page.goto(source).catch(error => {
            if (!/ERR_ABORTED|interrupted/.test(String(error))) throw error;
          });
          await expect(page).toHaveURL(enabled ? destination : source);
          await expect(page.locator('h1')).toHaveText(enabled ? 'Alternative page' : 'Allowed surface');
        }
      }
    } finally {
      await page.close();
      await popup.evaluate(async config => {
        const response = await chrome.runtime.sendMessage({ type: 'SET_CONFIG', payload: config });
        if (!response.success) throw new Error(response.error);
      }, originalConfig);
      await popup.close();
      await context.unroute('https://example.org/**');
      await context.unroute('https://www.youtube.com/**', sourceFixture);
      await context.unroute('https://www.reddit.com/**', sourceFixture);
    }
  });

});
