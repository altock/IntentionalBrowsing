import { PLATFORM_RULES } from '../shared/config.js';
import { getHardBlockSetting, normalizeAlternativeUrl } from '../shared/rules.js';
import type { PlatformId, StorageSchema } from '../shared/types.js';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Override built-in redirects with disabled surfaces or alternative destinations. */
export function getAlternativeRules(config: StorageSchema): {
  removeRuleIds: number[];
  addRules: chrome.declarativeNetRequest.Rule[];
} {
  const removeRuleIds: number[] = [];
  const addRules: chrome.declarativeNetRequest.Rule[] = [];
  Object.entries(PLATFORM_RULES).forEach(([id, rules], platformIndex) => {
    const platform = config.platforms[id as PlatformId];
    const destination = normalizeAlternativeUrl(platform.customSettings?.alternativeUrl);
    rules.patterns.forEach((pattern, index) => {
      if (pattern.mode === 'allow') return;
      const ruleId = 20000 + platformIndex * 100 + index;
      removeRuleIds.push(ruleId);
      if (!config.globalEnabled || !platform.enabled) return;
      const pathname = pattern.pattern.replace(/\/\*\*?$/, '') || '/';
      const blockSetting = pattern.mode === 'hard' ? getHardBlockSetting(id as PlatformId, pathname) : null;
      const disabled = blockSetting !== null && platform.hardBlocks[blockSetting] === false;
      if (!disabled && platform.redirectTarget !== 'custom') return;
      const hosts = rules.hosts.map(escapeRegex).join('|');
      const segments = pattern.pattern.split('/').filter(Boolean);
      const path = segments.map(segment => segment === '**' ? '(?:/[^?#]*)?' :
        segment === '*' ? '/[^/?#]+' : '/' + escapeRegex(segment)).join('');
      addRules.push({
        id: ruleId,
        priority: 2,
        // Omitting the custom redirect alone would leave lower-priority static blocks active.
        action: disabled ? { type: chrome.declarativeNetRequest.RuleActionType.ALLOW } : {
          type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
          redirect: destination ? { url: destination } : { extensionPath: '/ui/blocked.html' },
        },
        condition: {
          regexFilter: `^https?://(?:${hosts})(?::[0-9]+)?${path}/*(?:[?#].*)?$`,
          isUrlFilterCaseSensitive: true,
          resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME],
        },
      });
    });
  });
  return { removeRuleIds, addRules };
}
