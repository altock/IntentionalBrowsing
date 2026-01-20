import type { BlockDecision, BlockMode, PlatformId, StorageSchema } from './types.js';
import { PLATFORM_RULES, DEFAULT_STORAGE } from './config.js';

/**
 * Match a URL path against a pattern
 * Supports:
 * - Exact matches: /home
 * - Single segment wildcards: /user/* matches /user/john but not /user/john/posts
 * - Multi-segment wildcards: /explore/** matches /explore, /explore/tabs, /explore/tabs/for-you
 */
export function matchPattern(pattern: string, path: string): boolean {
  // Normalize paths - remove trailing slashes and extract path without query string
  const normalizedPath = path.split('?')[0].replace(/\/+$/, '') || '/';
  const normalizedPattern = pattern.replace(/\/+$/, '') || '/';

  // Split into segments
  const pathSegments = normalizedPath.split('/').filter(s => s !== '');
  const patternSegments = normalizedPattern.split('/').filter(s => s !== '');

  // Handle root path special case
  if (patternSegments.length === 0 && pathSegments.length === 0) {
    return true;
  }

  return matchSegments(patternSegments, pathSegments);
}

function matchSegments(pattern: string[], path: string[]): boolean {
  let pi = 0; // pattern index
  let si = 0; // path segment index

  while (pi < pattern.length) {
    const patternSeg = pattern[pi];

    if (patternSeg === '**') {
      // ** matches zero or more segments
      // If this is the last pattern segment, it matches everything remaining
      if (pi === pattern.length - 1) {
        return true;
      }

      // Try matching the rest of the pattern at each position
      for (let i = si; i <= path.length; i++) {
        if (matchSegments(pattern.slice(pi + 1), path.slice(i))) {
          return true;
        }
      }
      return false;
    }

    // No more path segments but pattern expects more (and it's not **)
    if (si >= path.length) {
      return false;
    }

    if (patternSeg === '*') {
      // * matches exactly one segment
      pi++;
      si++;
    } else {
      // Exact match required
      if (patternSeg !== path[si]) {
        return false;
      }
      pi++;
      si++;
    }
  }

  // Pattern exhausted - check if path is also exhausted
  return si >= path.length;
}

/**
 * Determine which platform (if any) a URL belongs to
 */
export function getPlatformFromUrl(url: string): PlatformId | null {
  let hostname: string;

  try {
    const parsed = new URL(url);
    hostname = parsed.hostname.toLowerCase();
  } catch {
    return null;
  }

  // Check each platform's hosts
  for (const [platformId, rules] of Object.entries(PLATFORM_RULES)) {
    for (const host of rules.hosts) {
      // Handle wildcard hosts (*.example.com)
      if (host.startsWith('*.')) {
        const domain = host.slice(2);
        if (hostname === domain || hostname.endsWith('.' + domain)) {
          return platformId as PlatformId;
        }
      } else {
        if (hostname === host) {
          return platformId as PlatformId;
        }
      }
    }
  }

  return null;
}

/**
 * Check a URL against platform rules (without considering config)
 */
export function checkUrl(url: string): BlockDecision {
  const platformId = getPlatformFromUrl(url);

  if (!platformId) {
    return {
      shouldBlock: false,
      mode: 'allow',
      reason: 'Unknown platform',
    };
  }

  const rules = PLATFORM_RULES[platformId];
  let pathname: string;

  try {
    const parsed = new URL(url);
    pathname = parsed.pathname;
  } catch {
    return {
      shouldBlock: false,
      mode: 'allow',
      reason: 'Invalid URL',
    };
  }

  // Find the first matching pattern
  for (const pattern of rules.patterns) {
    if (matchPattern(pattern.pattern, pathname)) {
      const shouldBlock = pattern.mode !== 'allow';
      return {
        shouldBlock,
        mode: pattern.mode,
        redirectUrl: shouldBlock ? (pattern.redirect || rules.defaultRedirect) : undefined,
        reason: pattern.description,
      };
    }
  }

  // No pattern matched - allow by default
  return {
    shouldBlock: false,
    mode: 'allow',
    reason: 'No matching pattern',
  };
}

/**
 * Get the block decision considering config, pause state, and platform settings
 */
export function getBlockDecision(url: string, config: StorageSchema): BlockDecision {
  // Check if globally disabled
  if (!config.globalEnabled) {
    return {
      shouldBlock: false,
      mode: 'allow',
      reason: 'Extension is globally disabled',
    };
  }

  const platformId = getPlatformFromUrl(url);

  if (!platformId) {
    return {
      shouldBlock: false,
      mode: 'allow',
      reason: 'Unknown platform',
    };
  }

  const platformConfig = config.platforms[platformId];

  // Check if platform is disabled
  if (!platformConfig.enabled) {
    return {
      shouldBlock: false,
      mode: 'allow',
      reason: `${platformId} is disabled`,
    };
  }

  // Get the base block decision from rules
  const baseDecision = checkUrl(url);

  if (!baseDecision.shouldBlock) {
    return baseDecision;
  }

  // Check if this specific block is disabled in config
  const rules = PLATFORM_RULES[platformId];
  let pathname: string;

  try {
    const parsed = new URL(url);
    pathname = parsed.pathname;
  } catch {
    return baseDecision;
  }

  // Find the matching pattern to determine which hard block setting applies
  for (const pattern of rules.patterns) {
    if (matchPattern(pattern.pattern, pathname) && pattern.mode === 'hard') {
      // Determine which hard block setting this corresponds to
      const blockSetting = getHardBlockSetting(platformId, pathname);
      if (blockSetting && platformConfig.hardBlocks[blockSetting] === false) {
        return {
          shouldBlock: false,
          mode: 'allow',
          reason: `Hard block '${blockSetting}' is disabled`,
        };
      }
      break;
    }
  }

  return baseDecision;
}

/**
 * Map a pathname to its corresponding hard block setting name
 */
function getHardBlockSetting(platformId: PlatformId, pathname: string): string | null {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';

  switch (platformId) {
    case 'twitter':
      if (normalizedPath === '/' || normalizedPath === '/home') {
        return 'home';
      }
      if (normalizedPath.startsWith('/explore')) {
        return 'explore';
      }
      break;

    case 'reddit':
      if (normalizedPath === '/' || normalizedPath === '/home') {
        return 'home';
      }
      if (normalizedPath === '/popular' || normalizedPath.startsWith('/popular/') ||
          normalizedPath === '/r/popular' || normalizedPath.startsWith('/r/popular/')) {
        return 'popular';
      }
      if (normalizedPath === '/all' || normalizedPath === '/r/all' ||
          normalizedPath.startsWith('/r/all/')) {
        return 'all';
      }
      break;

    case 'youtube':
      if (normalizedPath === '/') {
        return 'home';
      }
      if (normalizedPath === '/shorts' || normalizedPath.startsWith('/shorts/')) {
        return 'shorts';
      }
      if (normalizedPath === '/feed/trending') {
        return 'trending';
      }
      if (normalizedPath === '/feed/explore') {
        return 'explore';
      }
      break;

    case 'instagram':
      if (normalizedPath.startsWith('/explore')) {
        return 'explore';
      }
      if (normalizedPath.startsWith('/reels')) {
        return 'reels';
      }
      break;

    case 'facebook':
      if (normalizedPath.startsWith('/watch')) {
        return 'watch';
      }
      if (normalizedPath.startsWith('/reels')) {
        return 'reels';
      }
      break;

    case 'tiktok':
      return 'all';
  }

  return null;
}

/**
 * Build the redirect URL for a blocked page
 */
export function buildRedirectUrl(
  originalUrl: string,
  redirectTarget: string,
  extensionId?: string
): string {
  // Special case: redirect to blocked page
  if (redirectTarget === 'blocked') {
    const blockedPage = extensionId
      ? `chrome-extension://${extensionId}/ui/blocked.html`
      : '/ui/blocked.html';
    const params = new URLSearchParams({ url: originalUrl });
    return `${blockedPage}?${params.toString()}`;
  }

  // Special case: YouTube shorts redirect
  if (redirectTarget === 'shorts-redirect') {
    try {
      const url = new URL(originalUrl);
      const shortId = url.pathname.split('/shorts/')[1]?.split('/')[0];
      if (shortId) {
        return `${url.origin}/watch?v=${shortId}`;
      }
    } catch {
      // Fall through to default redirect
    }
    // Fallback if we can't extract short ID
    return buildRedirectUrl(originalUrl, '/feed/subscriptions', extensionId);
  }

  // Relative redirect on same domain
  try {
    const url = new URL(originalUrl);
    return `${url.origin}${redirectTarget}`;
  } catch {
    return redirectTarget;
  }
}
