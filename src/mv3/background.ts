/**
 * Background Service Worker (MV3)
 *
 * Handles:
 * - Dynamic rule management for declarativeNetRequest
 * - Message passing between content scripts and popup
 * - Storage management
 */

import { Storage } from '../shared/storage.js';
import { getBlockDecision, buildRedirectUrl, getPlatformFromUrl } from '../shared/rules.js';
import type { ExtensionMessage, ExtensionResponse, PlatformId, StorageSchema } from '../shared/types.js';

/**
 * Rule IDs for declarativeNetRequest
 */
const RULE_SET_IDS: Record<PlatformId, string> = {
  twitter: 'twitter_rules',
  reddit: 'reddit_rules',
  youtube: 'youtube_rules',
  instagram: 'instagram_rules',
  facebook: 'facebook_rules',
  linkedin: 'linkedin_rules',
  tiktok: 'tiktok_rules',
};

/**
 * Initialize the extension
 */
async function init(): Promise<void> {
  console.log('[IntentionalBrowsing] Initializing...');

  // Load config and sync rule states
  const config = await Storage.load();
  await syncRuleStates(config);

  console.log('[IntentionalBrowsing] Initialized with config:', config.globalEnabled ? 'enabled' : 'disabled');
}

/**
 * Sync declarativeNetRequest rule states with config
 */
async function syncRuleStates(config: StorageSchema): Promise<void> {
  const enableRulesetIds: string[] = [];
  const disableRulesetIds: string[] = [];

  for (const [platformId, ruleSetId] of Object.entries(RULE_SET_IDS)) {
    const platformConfig = config.platforms[platformId as PlatformId];
    const shouldEnable = config.globalEnabled && platformConfig.enabled;

    if (shouldEnable) {
      enableRulesetIds.push(ruleSetId);
    } else {
      disableRulesetIds.push(ruleSetId);
    }
  }

  try {
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds,
      disableRulesetIds,
    });
    console.log('[IntentionalBrowsing] Rule states synced');
  } catch (error) {
    console.error('[IntentionalBrowsing] Failed to sync rule states:', error);
  }
}

/**
 * Handle messages from content scripts and popup
 */
chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse: (response: ExtensionResponse) => void) => {
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
      return { success: true, data: config };
    }

    case 'SET_CONFIG': {
      const config = message.payload as StorageSchema;
      await Storage.save(config);
      await syncRuleStates(config);
      return { success: true };
    }

    case 'CHECK_URL': {
      const url = message.payload as string;
      const config = await Storage.load();
      const decision = getBlockDecision(url, config);
      return { success: true, data: decision };
    }

    case 'NAVIGATE': {
      const { tabId, url } = message.payload as { tabId: number; url: string };
      await chrome.tabs.update(tabId, { url });
      return { success: true };
    }

    case 'PAUSE': {
      const { duration, platformId } = message.payload as { duration: number; platformId?: PlatformId };
      const until = Date.now() + duration;
      await Storage.setPause(until, platformId);
      const config = await Storage.load();
      await syncRuleStates(config);
      return { success: true, data: { until } };
    }

    case 'RESUME': {
      const { platformId } = (message.payload as { platformId?: PlatformId }) || {};
      await Storage.clearPause(platformId);
      const config = await Storage.load();
      await syncRuleStates(config);
      return { success: true };
    }

    case 'GET_STATS': {
      const config = await Storage.load();
      return { success: true, data: config.stats };
    }

    case 'INCREMENT_BLOCK_COUNT': {
      await Storage.incrementBlockCount();
      return { success: true };
    }

    case 'URL_CHANGED': {
      const { url, tabId } = message.payload as { url: string; tabId?: number };
      const config = await Storage.load();
      const decision = getBlockDecision(url, config);

      if (decision.shouldBlock && decision.mode === 'hard' && decision.redirectUrl) {
        const redirectUrl = buildRedirectUrl(url, decision.redirectUrl, chrome.runtime.id);

        // Increment block count
        await Storage.incrementBlockCount();

        // Redirect the tab
        if (tabId) {
          await chrome.tabs.update(tabId, { url: redirectUrl });
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
 * Handle navigation events for SPA redirects
 */
chrome.webNavigation?.onHistoryStateUpdated.addListener(async (details) => {
  if (details.frameId !== 0) return; // Only main frame

  const config = await Storage.load();
  const decision = getBlockDecision(details.url, config);

  if (decision.shouldBlock && decision.mode === 'hard' && decision.redirectUrl) {
    const redirectUrl = buildRedirectUrl(details.url, decision.redirectUrl, chrome.runtime.id);
    await Storage.incrementBlockCount();
    await chrome.tabs.update(details.tabId, { url: redirectUrl });
  }
});

/**
 * Listen for storage changes to sync rule states
 */
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === 'local' && changes.config) {
    const newConfig = changes.config.newValue as StorageSchema;
    await syncRuleStates(newConfig);
  }
});

/**
 * Track blocked requests for stats
 */
chrome.declarativeNetRequest.onRuleMatchedDebug?.addListener(async (info) => {
  console.log('[IntentionalBrowsing] Rule matched:', info);
  await Storage.incrementBlockCount();
});

// Initialize on install/update
chrome.runtime.onInstalled.addListener(init);

// Initialize on startup
chrome.runtime.onStartup.addListener(init);

// Also run init immediately for when extension is loaded
init();
