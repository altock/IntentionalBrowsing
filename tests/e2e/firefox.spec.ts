import { test as base, expect, type BrowserContext } from '@playwright/test';
import { firefox } from 'playwright';
import { connectWithMaxRetries, findFreeTcpPort } from 'playwright-webextext/dist/firefox_remote.js';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * E2E tests for the Intentional Browsing Firefox extension.
 *
 * These tests verify the extension's behavior by:
 * 1. Testing that navigation-level blocking works (redirect from twitter.com)
 * 2. Testing the popup HTML directly via file:// protocol (as a fallback)
 *
 * Note: Firefox extension popup testing via moz-extension:// URLs is challenging
 * because Firefox generates a random UUID for each temporary extension installation.
 * The UUID is not easily discoverable through Playwright's API.
 *
 * Uses playwright-webextext to load the Firefox extension.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionPath = path.resolve(__dirname, '../../dist/firefox');
const popupHtmlPath = path.resolve(extensionPath, 'ui/popup.html');

// Test state shared across tests
let firefoxContext: BrowserContext | null = null;

// Custom test fixture that manages the Firefox browser with extension
const test = base.extend<{
  firefoxWithExtension: BrowserContext;
}>({
  firefoxWithExtension: [
    async ({}, use) => {
      // Use a persistent Firefox context. Contexts created by browser.newContext()
      // are private, and temporary extensions cannot expose their internal pages there.
      if (!firefoxContext) {
        console.log('Launching Firefox with extension...');
        const debuggingPort = await findFreeTcpPort();
        firefoxContext = await firefox.launchPersistentContext('', {
          headless: false,
          args: ['--start-debugger-server', String(debuggingPort)],
          firefoxUserPrefs: {
            'devtools.debugger.remote-enabled': true,
            'devtools.debugger.prompt-connection': false,
            'extensions.manifestV3.enabled': true,
          },
        });

        const remoteFirefox = await connectWithMaxRetries({ port: debuggingPort });
        await remoteFirefox.installTemporaryAddon(extensionPath);
        remoteFirefox.disconnect();

        // Wait for extension to initialize
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      await use(firefoxContext);
    },
    { scope: 'worker' },
  ],
});

test.describe('Intentional Browsing Firefox Extension', () => {
  test.afterAll(async () => {
    if (firefoxContext) {
      await firefoxContext.close();
      firefoxContext = null;
    }
  });

  test('extension loads and browser stays connected', async ({ firefoxWithExtension }) => {
    // Verify the persistent context remains usable after the add-on loads.
    const page = await firefoxWithExtension.newPage();

    // Navigate to a simple page to verify browser works
    await page.goto('https://example.com', { timeout: 30000 });
    const title = await page.title();
    expect(title).toContain('Example');

    await page.close();
  });

  test('extension redirects YouTube Trending to the configured subscriptions feed', async ({ firefoxWithExtension }) => {
    const page = await firefoxWithExtension.newPage();

    // This uses an external redirect because Playwright's Firefox driver cannot
    // navigate a test page to a moz-extension:// URL.
    console.log('Navigating to YouTube Trending...');
    void page.goto('https://www.youtube.com/feed/trending', { timeout: 30000, waitUntil: 'commit' }).catch((error) => {
      console.log('Navigation was interrupted by a potential redirect:', error);
    });

    await page.waitForURL('**/feed/subscriptions', { timeout: 10000 });

    const currentUrl = page.url();
    console.log(`Final URL: ${currentUrl}`);

    expect(currentUrl).toContain('/feed/subscriptions');

    await page.close();
  });

  test('popup HTML renders correctly when loaded directly', async ({ firefoxWithExtension }) => {
    // This test loads the popup HTML directly via file:// protocol
    // This tests the HTML/CSS rendering but NOT the JavaScript functionality
    // (since chrome.* APIs aren't available outside extension context)

    const page = await firefoxWithExtension.newPage();

    // Load the popup HTML directly
    const fileUrl = `file://${popupHtmlPath}`;
    console.log(`Loading popup from: ${fileUrl}`);
    await page.goto(fileUrl, { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Check that the popup HTML structure is correct
    // Wait for the popup container
    await page.waitForSelector('.popup', { timeout: 5000 });

    // Verify popup title is present
    const title = await page.locator('.title').textContent();
    expect(title).toBe('Intentional Browsing');

    // Verify header elements exist
    const header = page.locator('.header');
    await expect(header).toBeVisible();

    // Verify global toggle exists
    const globalToggle = page.locator('#global-enabled');
    await expect(globalToggle).toHaveCount(1);

    // Verify platforms container exists
    const platforms = page.locator('#platforms');
    await expect(platforms).toBeVisible();

    // Note: Platform toggles won't be rendered because the JavaScript
    // requires chrome.runtime.sendMessage which isn't available outside
    // the extension context. This is a known limitation of this test approach.

    console.log('Popup HTML structure verified successfully');

    await page.close();
  });

  test('popup HTML has all required elements', async ({ firefoxWithExtension }) => {
    const page = await firefoxWithExtension.newPage();

    await page.goto(`file://${popupHtmlPath}`);

    // Check all required CSS classes and IDs exist
    const requiredSelectors = [
      '.popup',
      '.header',
      '.title',
      '.global-toggle',
      '#global-enabled',
      '.toggle-slider',
      '#platforms',
    ];

    for (const selector of requiredSelectors) {
      const element = page.locator(selector);
      await expect(element).toHaveCount(1);
    }

    await page.close();
  });

  test('popup CSS is linked correctly', async ({ firefoxWithExtension }) => {
    const page = await firefoxWithExtension.newPage();

    await page.goto(`file://${popupHtmlPath}`);

    // Check that popup.css is linked
    const cssLink = page.locator('link[href="popup.css"]');
    await expect(cssLink).toHaveCount(1);

    await page.close();
  });

  test('popup script is linked correctly', async ({ firefoxWithExtension }) => {
    const page = await firefoxWithExtension.newPage();

    await page.goto(`file://${popupHtmlPath}`);

    // Check that popup.js is linked (build process may remove type="module")
    const script = page.locator('script[src="popup.js"]');
    await expect(script).toHaveCount(1);

    await page.close();
  });
});
