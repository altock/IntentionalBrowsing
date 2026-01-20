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
 * Dynamic rule IDs for platforms with configurable redirect targets
 * Using IDs 10001+ to avoid conflicts with static rules
 * Each platform gets a range of 100 IDs
 */
const DYNAMIC_RULE_ID_BASE: Record<PlatformId, number> = {
  twitter: 10000,
  youtube: 10100,
  instagram: 10200,
  facebook: 10300,
  linkedin: 10400,
  tiktok: 10500,
  reddit: 10600, // Reddit only has 'blocked' option, but include for consistency
};

/**
 * URL patterns for blocking each platform's feed/home pages
 */
const PLATFORM_BLOCK_PATTERNS: Record<PlatformId, string[]> = {
  twitter: [
    '^https?://(?:www\\.|mobile\\.)?(?:twitter|x)\\.com/?(?:\\?.*)?$',
    '^https?://(?:www\\.|mobile\\.)?(?:twitter|x)\\.com/home(?:\\?.*)?$',
  ],
  youtube: [
    '^https?://(?:www\\.|m\\.)?youtube\\.com/?(?:\\?.*)?$',
    '^https?://(?:www\\.|m\\.)?youtube\\.com/shorts(?:/.*)?(?:\\?.*)?$',
    '^https?://(?:www\\.|m\\.)?youtube\\.com/feed/trending(?:\\?.*)?$',
    '^https?://(?:www\\.|m\\.)?youtube\\.com/feed/explore(?:\\?.*)?$',
  ],
  instagram: [
    '^https?://(?:www\\.)?instagram\\.com/?(?:\\?.*)?$',
    '^https?://(?:www\\.)?instagram\\.com/explore(?:/.*)?(?:\\?.*)?$',
    '^https?://(?:www\\.)?instagram\\.com/reels(?:/.*)?(?:\\?.*)?$',
  ],
  facebook: [
    '^https?://(?:www\\.|m\\.)?facebook\\.com/?(?:\\?.*)?$',
    '^https?://(?:www\\.|m\\.)?facebook\\.com/watch(?:/.*)?(?:\\?.*)?$',
    '^https?://(?:www\\.|m\\.)?facebook\\.com/reels(?:/.*)?(?:\\?.*)?$',
  ],
  linkedin: [
    '^https?://(?:www\\.)?linkedin\\.com/?(?:\\?.*)?$',
    '^https?://(?:www\\.)?linkedin\\.com/feed(?:/.*)?(?:\\?.*)?$',
  ],
  tiktok: [
    '^https?://(?:www\\.)?tiktok\\.com(?:/.*)?(?:\\?.*)?$',
  ],
  reddit: [], // Reddit uses static rules only
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

  // Sync dynamic rules for all platforms with configurable redirect targets
  await syncDynamicBlockRules(config);
}

/**
 * Sync dynamic block rules for all platforms
 * Uses dynamic rules because redirect destinations are user-configurable
 */
async function syncDynamicBlockRules(config: StorageSchema): Promise<void> {
  const allRulesToAdd: chrome.declarativeNetRequest.Rule[] = [];
  const allRuleIdsToRemove: number[] = [];

  for (const platformId of Object.keys(PLATFORM_BLOCK_PATTERNS) as PlatformId[]) {
    const patterns = PLATFORM_BLOCK_PATTERNS[platformId];
    if (patterns.length === 0) continue; // Skip platforms with no patterns (e.g., reddit)

    const platformConfig = config.platforms[platformId];
    const baseId = DYNAMIC_RULE_ID_BASE[platformId];
    const redirectTarget = platformConfig.redirectTarget;

    // Get all possible rule IDs for this platform
    const ruleIds = patterns.map((_, index) => baseId + index + 1);
    allRuleIdsToRemove.push(...ruleIds);

    const isEnabled = config.globalEnabled && platformConfig.enabled;
    const isBlockPage = redirectTarget === 'blocked';
    const isPathRedirect = redirectTarget.startsWith('/');

    if (isEnabled && (isBlockPage || isPathRedirect)) {
      // Create rules to redirect
      const rules = patterns.map((pattern, index) => {
        const action: chrome.declarativeNetRequest.RuleAction = isBlockPage
          ? {
              type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
              redirect: { extensionPath: '/ui/blocked.html' }
            }
          : {
              type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
              redirect: { transform: { path: redirectTarget } }
            };

        return {
          id: baseId + index + 1,
          priority: 1,
          action,
          condition: {
            regexFilter: pattern,
            resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME]
          }
        } as chrome.declarativeNetRequest.Rule;
      });

      allRulesToAdd.push(...rules);
    }
    // 'feed-block' and other non-path options don't need dynamic rules (handled by content scripts)
  }

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: allRuleIdsToRemove,
      addRules: allRulesToAdd
    });
    console.log(`[IntentionalBrowsing] Dynamic rules synced: ${allRulesToAdd.length} active`);
  } catch (error) {
    console.error('[IntentionalBrowsing] Failed to sync dynamic rules:', error);
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
