/**
 * Background Script (MV2 - Firefox)
 *
 * Simple blocking via webNavigation API.
 * Blocks algorithmic feeds, redirects to safe pages.
 */

declare const browser: typeof chrome | undefined;

import { Storage } from '../shared/storage.js';
import { applyConfigUpdate } from '../shared/config-updates.js';
import { getBlockDecision, buildRedirectUrl } from '../shared/rules.js';
import type { ConfigUpdate, ExtensionMessage, ExtensionResponse, StorageSchema } from '../shared/types.js';

const api = typeof browser !== 'undefined' ? browser : chrome;

let cachedConfig: StorageSchema | null = null;

const PLATFORM_URL_PATTERNS = [
  '*://twitter.com/*',
  '*://www.twitter.com/*',
  '*://mobile.twitter.com/*',
  '*://x.com/*',
  '*://www.x.com/*',
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

/**
 * Initialize the extension
 */
async function init(): Promise<void> {
  console.log('[IntentionalBrowsing] Initializing (MV2)...');
  cachedConfig = await Storage.load();
  setupNavigationListeners();
  console.log('[IntentionalBrowsing] Initialized:', cachedConfig.globalEnabled ? 'enabled' : 'disabled');
}

/**
 * Return the configured redirect for a hard-blocked URL.
 */
function getHardBlockRedirect(url: string): string | null {
  const config = cachedConfig;
  if (!config) {
    return null;
  }

  const decision = getBlockDecision(url, config);

  if (!decision.shouldBlock || decision.mode !== 'hard' || !decision.redirectUrl) {
    return null;
  }

  return buildRedirectUrl(url, decision.redirectUrl, api.runtime.id);
}

function recordBlock(): void {
  void Storage.incrementBlockCount()
    .then((config) => {
      cachedConfig = config;
    })
    .catch((error) => {
      console.error('[IntentionalBrowsing] Failed to record block:', error);
    });
}

/**
 * Handle a single-page application navigation after the initial request.
 */
async function handleHistoryNavigation(tabId: number, url: string): Promise<void> {
  const redirectUrl = getHardBlockRedirect(url);
  if (!redirectUrl) {
    return;
  }

  console.log('[IntentionalBrowsing] Blocking:', url, '→', redirectUrl);
  recordBlock();
  await api.tabs.update(tabId, { url: redirectUrl });
}

/**
 * Set up request and SPA navigation listeners.
 */
function setupNavigationListeners(): void {
  api.webNavigation.onHistoryStateUpdated.addListener(async (details) => {
    if (details.frameId !== 0) return;
    await handleHistoryNavigation(details.tabId, details.url);
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

  api.webRequest.onBeforeRequest.addListener((details) => {
    const redirectUrl = getHardBlockRedirect(details.url);
    if (!redirectUrl) {
      return;
    }

    console.log('[IntentionalBrowsing] Blocking:', details.url, '→', redirectUrl);
    recordBlock();
    return { redirectUrl };
  }, {
    urls: PLATFORM_URL_PATTERNS,
    types: ['main_frame'],
  }, ['blocking']);
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
      cachedConfig = await Storage.update(() => config);
      return { success: true, data: cachedConfig };
    }

    case 'UPDATE_CONFIG': {
      const update = message.payload as ConfigUpdate;
      cachedConfig = await Storage.update((currentConfig) =>
        applyConfigUpdate(currentConfig, update)
      );
      return { success: true, data: cachedConfig };
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
