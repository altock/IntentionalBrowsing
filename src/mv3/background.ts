/**
 * Background Service Worker (MV3)
 *
 * Manages declarativeNetRequest rules and handles messages from popup/content scripts.
 */

import { Storage } from '../shared/storage.js';
import { getBlockDecision } from '../shared/rules.js';
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
 * Dynamic rule IDs for Twitter (since redirect target is configurable)
 * Using IDs 10001+ to avoid conflicts with static rules
 */
const TWITTER_DYNAMIC_RULE_IDS = [10001, 10002];

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

  // Sync Twitter dynamic rules (since redirect target is configurable)
  await syncTwitterDynamicRules(config);
}

/**
 * Sync Twitter's dynamic rules based on redirect target setting
 * Uses dynamic rules because the redirect destination is user-configurable
 */
async function syncTwitterDynamicRules(config: StorageSchema): Promise<void> {
  const twitterConfig = config.platforms.twitter;
  const shouldBlock = config.globalEnabled &&
                      twitterConfig.enabled &&
                      twitterConfig.redirectTarget === 'blocked';

  try {
    if (shouldBlock) {
      // Add dynamic rules to redirect Twitter home/feed to blocked page
      const rules: chrome.declarativeNetRequest.Rule[] = [
        {
          id: TWITTER_DYNAMIC_RULE_IDS[0],
          priority: 1,
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
            redirect: {
              extensionPath: '/ui/blocked.html'
            }
          },
          condition: {
            regexFilter: '^https?://(?:www\\.|mobile\\.)?(?:twitter|x)\\.com/?(?:\\?.*)?$',
            resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME]
          }
        },
        {
          id: TWITTER_DYNAMIC_RULE_IDS[1],
          priority: 1,
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
            redirect: {
              extensionPath: '/ui/blocked.html'
            }
          },
          condition: {
            regexFilter: '^https?://(?:www\\.|mobile\\.)?(?:twitter|x)\\.com/home(?:\\?.*)?$',
            resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME]
          }
        }
      ];

      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: TWITTER_DYNAMIC_RULE_IDS,
        addRules: rules
      });
      console.log('[IntentionalBrowsing] Twitter dynamic block rules added');
    } else {
      // Remove dynamic rules (let content script handle other redirect options)
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: TWITTER_DYNAMIC_RULE_IDS
      });
      console.log('[IntentionalBrowsing] Twitter dynamic block rules removed');
    }
  } catch (error) {
    console.error('[IntentionalBrowsing] Failed to sync Twitter dynamic rules:', error);
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

    case 'GET_STATS': {
      const config = await Storage.load();
      return { success: true, data: config.stats };
    }

    case 'INCREMENT_BLOCK_COUNT': {
      await Storage.incrementBlockCount();
      return { success: true };
    }

    default:
      return { success: false, error: `Unknown message type: ${message.type}` };
  }
}

/**
 * Listen for storage changes to sync rule states
 */
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === 'local' && changes.config) {
    const newConfig = changes.config.newValue as StorageSchema;
    await syncRuleStates(newConfig);
  }
});

// Initialize on install/update
chrome.runtime.onInstalled.addListener(init);

// Initialize on startup
chrome.runtime.onStartup.addListener(init);

// Also run init immediately for when extension is loaded
init();
