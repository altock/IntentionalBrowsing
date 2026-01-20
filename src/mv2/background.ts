/**
 * Background Script (MV2 - Firefox)
 *
 * Uses webRequest API for blocking (instead of declarativeNetRequest)
 */

import { Storage } from '../shared/storage.js';
import { getBlockDecision, buildRedirectUrl, getPlatformFromUrl } from '../shared/rules.js';
import type { ExtensionMessage, ExtensionResponse, PlatformId, StorageSchema } from '../shared/types.js';

// Cache config to avoid async storage access in webRequest handler
let cachedConfig: StorageSchema | null = null;

/**
 * Initialize the extension
 */
async function init(): Promise<void> {
  console.log('[IntentionalBrowsing] Initializing (MV2)...');

  // Load and cache config
  cachedConfig = await Storage.load();

  // Set up webRequest listener
  setupWebRequestListener();

  console.log('[IntentionalBrowsing] Initialized with config:', cachedConfig.globalEnabled ? 'enabled' : 'disabled');
}

/**
 * Set up webRequest listener for blocking
 */
function setupWebRequestListener(): void {
  const urls = [
    '*://twitter.com/*',
    '*://www.twitter.com/*',
    '*://x.com/*',
    '*://www.x.com/*',
    '*://mobile.twitter.com/*',
    '*://mobile.x.com/*',
    '*://reddit.com/*',
    '*://www.reddit.com/*',
    '*://old.reddit.com/*',
    '*://new.reddit.com/*',
    '*://youtube.com/*',
    '*://www.youtube.com/*',
    '*://m.youtube.com/*',
    '*://instagram.com/*',
    '*://www.instagram.com/*',
    '*://facebook.com/*',
    '*://www.facebook.com/*',
    '*://m.facebook.com/*',
    '*://linkedin.com/*',
    '*://www.linkedin.com/*',
    '*://tiktok.com/*',
    '*://www.tiktok.com/*',
  ];

  // Use browser namespace for Firefox compatibility
  const api = typeof browser !== 'undefined' ? browser : chrome;

  api.webRequest.onBeforeRequest.addListener(
    handleRequest,
    { urls, types: ['main_frame'] },
    ['blocking']
  );
}

/**
 * Handle a web request
 */
function handleRequest(
  details: chrome.webRequest.WebRequestBodyDetails
): chrome.webRequest.BlockingResponse | void {
  if (!cachedConfig) {
    return; // Config not loaded yet
  }

  const decision = getBlockDecision(details.url, cachedConfig);

  if (decision.shouldBlock && decision.mode === 'hard' && decision.redirectUrl) {
    // Get extension ID for redirect URL
    const api = typeof browser !== 'undefined' ? browser : chrome;
    const extensionId = api.runtime.id;
    const redirectUrl = buildRedirectUrl(details.url, decision.redirectUrl, extensionId);

    // Increment block count asynchronously
    Storage.incrementBlockCount().catch(console.error);

    return { redirectUrl };
  }
}

/**
 * Handle messages from content scripts and popup
 */
const api = typeof browser !== 'undefined' ? browser : chrome;

api.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender: chrome.runtime.MessageSender, sendResponse: (response: ExtensionResponse) => void) => {
    handleMessage(message)
      .then(sendResponse)
      .catch(error => {
        console.error('[IntentionalBrowsing] Message handler error:', error);
        sendResponse({ success: false, error: error.message });
      });

    // Return true to indicate async response
    return true;
  }
);

async function handleMessage(message: ExtensionMessage): Promise<ExtensionResponse> {
  switch (message.type) {
    case 'GET_CONFIG': {
      const config = await Storage.load();
      cachedConfig = config;
      return { success: true, data: config };
    }

    case 'SET_CONFIG': {
      const config = message.payload as StorageSchema;
      await Storage.save(config);
      cachedConfig = config;
      return { success: true };
    }

    case 'CHECK_URL': {
      const url = message.payload as string;
      const config = cachedConfig || await Storage.load();
      const decision = getBlockDecision(url, config);
      return { success: true, data: decision };
    }

    case 'NAVIGATE': {
      const { tabId, url } = message.payload as { tabId: number; url: string };
      const navApi = typeof browser !== 'undefined' ? browser : chrome;
      await navApi.tabs.update(tabId, { url });
      return { success: true };
    }

    case 'PAUSE': {
      const { duration, platformId } = message.payload as { duration: number; platformId?: PlatformId };
      const until = Date.now() + duration;
      await Storage.setPause(until, platformId);
      cachedConfig = await Storage.load();
      return { success: true, data: { until } };
    }

    case 'RESUME': {
      const { platformId } = (message.payload as { platformId?: PlatformId }) || {};
      await Storage.clearPause(platformId);
      cachedConfig = await Storage.load();
      return { success: true };
    }

    case 'GET_STATS': {
      const config = cachedConfig || await Storage.load();
      return { success: true, data: config.stats };
    }

    case 'INCREMENT_BLOCK_COUNT': {
      await Storage.incrementBlockCount();
      cachedConfig = await Storage.load();
      return { success: true };
    }

    case 'URL_CHANGED': {
      const { url, tabId } = message.payload as { url: string; tabId?: number };
      const config = cachedConfig || await Storage.load();
      const decision = getBlockDecision(url, config);

      if (decision.shouldBlock && decision.mode === 'hard' && decision.redirectUrl) {
        const navApi = typeof browser !== 'undefined' ? browser : chrome;
        const redirectUrl = buildRedirectUrl(url, decision.redirectUrl, navApi.runtime.id);

        // Increment block count
        await Storage.incrementBlockCount();
        cachedConfig = await Storage.load();

        // Redirect the tab
        if (tabId) {
          await navApi.tabs.update(tabId, { url: redirectUrl });
        }

        return { success: true, data: { blocked: true, redirectUrl } };
      }

      return { success: true, data: { blocked: false } };
    }

    default:
      return { success: false, error: `Unknown message type: ${message.type}` };
  }
}

/**
 * Listen for storage changes to update cache
 */
api.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === 'local' && changes.config) {
    cachedConfig = changes.config.newValue as StorageSchema;
  }
});

// Initialize
init();
