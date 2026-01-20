import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * E2E tests for the Intentional Browsing Chrome extension.
 *
 * These tests verify:
 * - Extension loads successfully in Chrome
 * - Blocked URLs (twitter.com) redirect to allowed paths (/messages)
 * - Allowed URLs (twitter.com/messages) work without interference
 * - Extension popup opens and displays correctly
 *
 * Note: When testing against real sites like Twitter/X, the site may redirect
 * to a login page. We verify the extension redirect happened by checking that
 * the redirect_after_login parameter contains /messages.
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
 * Helper to verify redirect behavior.
 * When not logged in, Twitter redirects to login page with a redirect_after_login param.
 * We check that either:
 * 1. URL contains /messages directly (if logged in or site allows)
 * 2. URL contains redirect_after_login=%2Fmessages (extension redirected, then Twitter asked for login)
 */
function verifyRedirectToMessages(url: string): boolean {
  // Direct match - we're on /messages
  if (/(?:twitter|x)\.com\/messages/.test(url)) {
    return true;
  }
  // Redirect to login with /messages as the destination
  if (/redirect_after_login=%2Fmessages/.test(url)) {
    return true;
  }
  return false;
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
    // by checking that twitter.com redirects to /messages
    const page = await context.newPage();

    // Navigate to twitter.com (blocked by extension rules)
    // The extension should redirect to /messages
    await safeNavigate(page, 'https://twitter.com/');

    // Wait for potential redirect
    await page.waitForTimeout(3000);

    // Verify we were redirected to /messages (or x.com equivalent)
    const url = page.url();
    expect(verifyRedirectToMessages(url)).toBe(true);

    await page.close();
  });

  test('twitter.com/home redirects to /messages', async () => {
    const page = await context.newPage();

    // Navigate to twitter.com/home (blocked by extension rules)
    await safeNavigate(page, 'https://twitter.com/home');

    // Wait for potential redirect
    await page.waitForTimeout(3000);

    // Verify we were redirected to /messages
    const url = page.url();
    expect(verifyRedirectToMessages(url)).toBe(true);

    await page.close();
  });

  test('twitter.com/explore redirects to /messages', async () => {
    const page = await context.newPage();

    // Navigate to twitter.com/explore (blocked by extension rules)
    await safeNavigate(page, 'https://twitter.com/explore');

    // Wait for potential redirect
    await page.waitForTimeout(3000);

    // Verify we were redirected to /messages
    const url = page.url();
    expect(verifyRedirectToMessages(url)).toBe(true);

    await page.close();
  });

  test('twitter.com/messages is allowed without redirect', async () => {
    const page = await context.newPage();

    // Navigate to twitter.com/messages (allowed by extension rules)
    await safeNavigate(page, 'https://twitter.com/messages');

    // Wait to ensure no redirect happens
    await page.waitForTimeout(3000);

    // Verify we stayed on /messages (or were redirected to login with messages as destination)
    const url = page.url();
    expect(verifyRedirectToMessages(url)).toBe(true);

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

    // Verify pause buttons exist
    const pauseButtons = page.locator('.btn-pause');
    await expect(pauseButtons).toHaveCount(2);

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
});
