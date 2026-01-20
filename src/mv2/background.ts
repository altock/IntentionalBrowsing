/**
 * Background Script (MV2 - Firefox)
 *
 * Simple blocking via webNavigation API.
 * Blocks algorithmic feeds, redirects to safe pages.
 */

declare const browser: typeof chrome | undefined;

import { Storage } from '../shared/storage.js';
import { getBlockDecision, buildRedirectUrl } from '../shared/rules.js';
import type { ExtensionMessage, ExtensionResponse, StorageSchema } from '../shared/types.js';

const api = typeof browser !== 'undefined' ? browser : chrome;

let cachedConfig: StorageSchema | null = null;

/**
 * Initialize the extension
 */
async function init(): Promise<void> {
  console.log('[IntentionalBrowsing] Initializing (MV2)...');
  cachedConfig = await Storage.load();
  setupWebNavigationListeners();
  console.log('[IntentionalBrowsing] Initialized:', cachedConfig.globalEnabled ? 'enabled' : 'disabled');
}

/**
 * Handle a navigation to potentially blocked URL
 */
async function handleNavigation(tabId: number, url: string): Promise<void> {
  const config = cachedConfig || await Storage.load();
  const decision = getBlockDecision(url, config);

  if (!decision.shouldBlock || decision.mode !== 'hard' || !decision.redirectUrl) {
    return;
  }

  const redirectUrl = buildRedirectUrl(url, decision.redirectUrl, api.runtime.id);

  console.log('[IntentionalBrowsing] Blocking:', url, '→', redirectUrl);
  await Storage.incrementBlockCount();
  cachedConfig = await Storage.load();
  await api.tabs.update(tabId, { url: redirectUrl });
}

/**
 * Set up webNavigation listeners
 */
function setupWebNavigationListeners(): void {
  api.webNavigation.onBeforeNavigate.addListener(async (details) => {
    if (details.frameId !== 0) return;
    await handleNavigation(details.tabId, details.url);
  });

  api.webNavigation.onHistoryStateUpdated.addListener(async (details) => {
    if (details.frameId !== 0) return;
    await handleNavigation(details.tabId, details.url);
  }, {
    url: [
      { hostContains: 'twitter.com' },
      { hostContains: 'x.com' },
      { hostContains: 'reddit.com' },
      { hostContains: 'youtube.com' },
      { hostContains: 'instagram.com' },
      { hostContains: 'facebook.com' },
      { hostContains: 'linkedin.com' },
      { hostContains: 'tiktok.com' },
    ]
  });
}

/**
 * Handle messages from content scripts and popup
 */
api.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender: chrome.runtime.MessageSender, sendResponse: (response: ExtensionResponse) => void) => {
    handleMessage(message)
      .then(sendResponse)
      .catch(error => {
        console.error('[IntentionalBrowsing] Message handler error:', error);
        sendResponse({ success: false, error: error.message });
      });
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
      await api.tabs.update(tabId, { url });
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

    default:
      return { success: false, error: `Unknown message type: ${message.type}` };
  }
}

/**
 * Listen for storage changes
 */
api.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === 'local' && changes.config) {
    cachedConfig = changes.config.newValue as StorageSchema;
  }
});

init();
