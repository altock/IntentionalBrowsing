import type {
  PlatformConfig,
  PlatformId,
  PlatformRules,
  PlatformSelectors,
  StorageSchema,
} from './types.js';

/**
 * Current schema version for migrations
 */
export const SCHEMA_VERSION = 1;

/**
 * Default Twitter configuration
 */
export const TWITTER_DEFAULT: PlatformConfig = {
  enabled: true,
  hardBlocks: {
    home: true,
  },
  softBlocks: {},
  redirectTarget: 'blocked',
};

/**
 * Default Reddit configuration
 */
export const REDDIT_DEFAULT: PlatformConfig = {
  enabled: true,
  hardBlocks: {
    home: true,
    popular: true,
    all: true,
  },
  softBlocks: {},
  redirectTarget: 'blocked',
  customSettings: {
    blockedSubreddits: [],
  },
};

/**
 * Default YouTube configuration
 */
export const YOUTUBE_DEFAULT: PlatformConfig = {
  enabled: true,
  hardBlocks: {
    home: true,
    shorts: true,
    trending: true,
    explore: true,
  },
  softBlocks: {
    recommendations: true,
    endCards: true,
    shortsInFeed: true,
  },
  redirectTarget: 'feed-block',
  customSettings: {
    disableAutoplay: true,
    shortsRedirectToWatch: true,
  },
};

/**
 * Default Instagram configuration
 */
export const INSTAGRAM_DEFAULT: PlatformConfig = {
  enabled: true,
  hardBlocks: {
    home: true,
    explore: true,
    reels: true,
  },
  softBlocks: {},
  redirectTarget: '/direct/inbox/',
};

/**
 * Default Facebook configuration
 */
export const FACEBOOK_DEFAULT: PlatformConfig = {
  enabled: false, // Off by default
  hardBlocks: {
    watch: true,
    reels: true,
  },
  softBlocks: {
    feed: true,
    stories: true,
    peopleYouMayKnow: true,
  },
  redirectTarget: '/messages/',
};

/**
 * Default LinkedIn configuration
 */
export const LINKEDIN_DEFAULT: PlatformConfig = {
  enabled: false, // Off by default
  hardBlocks: {},
  softBlocks: {
    feed: true,
    peopleYouMayKnow: true,
  },
  redirectTarget: 'feed-block',
};

/**
 * Default TikTok configuration (nuclear option)
 */
export const TIKTOK_DEFAULT: PlatformConfig = {
  enabled: true,
  hardBlocks: {
    all: true, // Block entire site by default
  },
  softBlocks: {},
  redirectTarget: 'blocked',
};

/**
 * Default configuration for all platforms
 */
export const DEFAULT_PLATFORMS: Record<PlatformId, PlatformConfig> = {
  twitter: TWITTER_DEFAULT,
  reddit: REDDIT_DEFAULT,
  youtube: YOUTUBE_DEFAULT,
  instagram: INSTAGRAM_DEFAULT,
  facebook: FACEBOOK_DEFAULT,
  linkedin: LINKEDIN_DEFAULT,
  tiktok: TIKTOK_DEFAULT,
};

/**
 * Default storage schema
 */
export const DEFAULT_STORAGE: StorageSchema = {
  schemaVersion: SCHEMA_VERSION,
  globalEnabled: true,
  platforms: DEFAULT_PLATFORMS,
  stats: {
    blocksTotal: 0,
    lastBlock: null,
  },
};

/**
 * Twitter URL rules
 */
export const TWITTER_RULES: PlatformRules = {
  hosts: ['twitter.com', 'x.com', 'www.twitter.com', 'www.x.com', 'mobile.twitter.com', 'mobile.x.com'],
  patterns: [
    { pattern: '/', mode: 'hard', redirect: 'blocked', description: 'Home feed' },
    { pattern: '/home', mode: 'hard', redirect: 'blocked', description: 'Home feed (explicit)' },
    { pattern: '/explore', mode: 'allow', description: 'Explore page' },
    { pattern: '/explore/**', mode: 'allow', description: 'Explore subpages' },
    { pattern: '/search', mode: 'allow', description: 'Search' },
    { pattern: '/search/**', mode: 'allow', description: 'Search results' },
    { pattern: '/notifications', mode: 'allow', description: 'Notifications' },
    { pattern: '/notifications/**', mode: 'allow', description: 'Notification details' },
    { pattern: '/messages', mode: 'allow', description: 'DMs' },
    { pattern: '/messages/**', mode: 'allow', description: 'DM threads' },
    { pattern: '/i/**', mode: 'allow', description: 'Internal pages' },
    { pattern: '/settings/**', mode: 'allow', description: 'Settings' },
    { pattern: '/*/status/*', mode: 'allow', description: 'Individual tweets' },
    { pattern: '/*', mode: 'allow', description: 'User profiles' },
  ],
  defaultRedirect: 'blocked',
};

/**
 * Reddit URL rules
 */
export const REDDIT_RULES: PlatformRules = {
  hosts: ['reddit.com', 'www.reddit.com', 'old.reddit.com', 'new.reddit.com'],
  patterns: [
    { pattern: '/', mode: 'hard', redirect: 'blocked', description: 'Home feed' },
    { pattern: '/home', mode: 'hard', redirect: 'blocked', description: 'Home feed (explicit)' },
    { pattern: '/popular', mode: 'hard', redirect: 'blocked', description: 'Popular' },
    { pattern: '/popular/**', mode: 'hard', redirect: 'blocked', description: 'Popular subpages' },
    { pattern: '/all', mode: 'hard', redirect: 'blocked', description: 'r/all' },
    { pattern: '/r/all', mode: 'hard', redirect: 'blocked', description: 'r/all (explicit)' },
    { pattern: '/r/all/**', mode: 'hard', redirect: 'blocked', description: 'r/all subpages' },
    { pattern: '/r/popular', mode: 'hard', redirect: 'blocked', description: 'r/popular' },
    { pattern: '/r/popular/**', mode: 'hard', redirect: 'blocked', description: 'r/popular subpages' },
    { pattern: '/search', mode: 'allow', description: 'Search' },
    { pattern: '/search/**', mode: 'allow', description: 'Search results' },
    { pattern: '/r/*/comments/**', mode: 'allow', description: 'Post comments' },
    { pattern: '/r/*', mode: 'allow', description: 'Subreddits' },
    { pattern: '/r/**', mode: 'allow', description: 'Subreddit pages' },
    { pattern: '/user/*', mode: 'allow', description: 'User profiles' },
    { pattern: '/user/**', mode: 'allow', description: 'User pages' },
    { pattern: '/u/*', mode: 'allow', description: 'User profiles (short)' },
    { pattern: '/u/**', mode: 'allow', description: 'User pages (short)' },
    { pattern: '/message/**', mode: 'allow', description: 'Messages' },
    { pattern: '/settings/**', mode: 'allow', description: 'Settings' },
  ],
  defaultRedirect: 'blocked',
};

/**
 * YouTube URL rules
 */
export const YOUTUBE_RULES: PlatformRules = {
  hosts: ['youtube.com', 'www.youtube.com', 'm.youtube.com'],
  patterns: [
    { pattern: '/', mode: 'soft', description: 'Home (soft block, show search)' },
    { pattern: '/shorts', mode: 'hard', redirect: '/feed/subscriptions', description: 'Shorts tab' },
    { pattern: '/shorts/*', mode: 'hard', redirect: 'shorts-redirect', description: 'Individual short' },
    { pattern: '/feed/trending', mode: 'hard', redirect: '/feed/subscriptions', description: 'Trending' },
    { pattern: '/feed/explore', mode: 'hard', redirect: '/feed/subscriptions', description: 'Explore' },
    { pattern: '/feed/subscriptions', mode: 'allow', description: 'Subscriptions' },
    { pattern: '/feed/library', mode: 'allow', description: 'Library' },
    { pattern: '/feed/history', mode: 'allow', description: 'History' },
    { pattern: '/watch', mode: 'allow', description: 'Video player' },
    { pattern: '/results', mode: 'allow', description: 'Search results' },
    { pattern: '/@*', mode: 'allow', description: 'Channel pages' },
    { pattern: '/channel/**', mode: 'allow', description: 'Channel pages (old format)' },
    { pattern: '/c/**', mode: 'allow', description: 'Channel pages (custom URL)' },
    { pattern: '/playlist', mode: 'allow', description: 'Playlists' },
    { pattern: '/premium', mode: 'allow', description: 'Premium page' },
    { pattern: '/account/**', mode: 'allow', description: 'Account settings' },
  ],
  defaultRedirect: '/feed/subscriptions',
};

/**
 * Instagram URL rules
 */
export const INSTAGRAM_RULES: PlatformRules = {
  hosts: ['instagram.com', 'www.instagram.com'],
  patterns: [
    { pattern: '/', mode: 'hard', redirect: '/direct/inbox/', description: 'Home feed' },
    { pattern: '/explore', mode: 'hard', redirect: '/direct/inbox/', description: 'Explore' },
    { pattern: '/explore/**', mode: 'hard', redirect: '/direct/inbox/', description: 'Explore pages' },
    { pattern: '/reels', mode: 'hard', redirect: '/direct/inbox/', description: 'Reels tab' },
    { pattern: '/reels/**', mode: 'hard', redirect: '/direct/inbox/', description: 'Individual reels' },
    { pattern: '/direct/inbox', mode: 'allow', description: 'DMs' },
    { pattern: '/direct/inbox/**', mode: 'allow', description: 'DM threads' },
    { pattern: '/direct/**', mode: 'allow', description: 'Direct messages' },
    { pattern: '/p/*', mode: 'allow', description: 'Individual posts' },
    { pattern: '/stories/**', mode: 'allow', description: 'Stories' },
    { pattern: '/accounts/**', mode: 'allow', description: 'Account settings' },
    { pattern: '/*', mode: 'allow', description: 'User profiles' },
  ],
  defaultRedirect: '/direct/inbox/',
};

/**
 * Facebook URL rules
 */
export const FACEBOOK_RULES: PlatformRules = {
  hosts: ['facebook.com', 'www.facebook.com', 'm.facebook.com'],
  patterns: [
    { pattern: '/', mode: 'soft', description: 'Home feed (soft block)' },
    { pattern: '/watch', mode: 'hard', redirect: '/messages/', description: 'Watch' },
    { pattern: '/watch/**', mode: 'hard', redirect: '/messages/', description: 'Watch videos' },
    { pattern: '/reels', mode: 'hard', redirect: '/messages/', description: 'Reels' },
    { pattern: '/reels/**', mode: 'hard', redirect: '/messages/', description: 'Individual reels' },
    { pattern: '/marketplace', mode: 'allow', description: 'Marketplace' },
    { pattern: '/marketplace/**', mode: 'allow', description: 'Marketplace pages' },
    { pattern: '/groups/**', mode: 'allow', description: 'Groups' },
    { pattern: '/messages', mode: 'allow', description: 'Messages' },
    { pattern: '/messages/**', mode: 'allow', description: 'Message threads' },
    { pattern: '/events', mode: 'allow', description: 'Events' },
    { pattern: '/events/**', mode: 'allow', description: 'Event pages' },
    { pattern: '/settings/**', mode: 'allow', description: 'Settings' },
    { pattern: '/*', mode: 'allow', description: 'User profiles and pages' },
  ],
  defaultRedirect: '/messages/',
};

/**
 * LinkedIn URL rules
 */
export const LINKEDIN_RULES: PlatformRules = {
  hosts: ['linkedin.com', 'www.linkedin.com'],
  patterns: [
    { pattern: '/', mode: 'soft', redirect: '/messaging/', description: 'Home feed (soft block)' },
    { pattern: '/feed', mode: 'soft', redirect: '/messaging/', description: 'Feed (soft block)' },
    { pattern: '/feed/**', mode: 'soft', redirect: '/messaging/', description: 'Feed pages' },
    { pattern: '/in/*', mode: 'allow', description: 'User profiles' },
    { pattern: '/messaging', mode: 'allow', description: 'Messages' },
    { pattern: '/messaging/**', mode: 'allow', description: 'Message threads' },
    { pattern: '/jobs', mode: 'allow', description: 'Jobs' },
    { pattern: '/jobs/**', mode: 'allow', description: 'Job listings' },
    { pattern: '/mynetwork', mode: 'allow', description: 'My Network' },
    { pattern: '/mynetwork/**', mode: 'allow', description: 'Network pages' },
    { pattern: '/company/**', mode: 'allow', description: 'Company pages' },
    { pattern: '/posts/**', mode: 'allow', description: 'Individual posts' },
    { pattern: '/settings/**', mode: 'allow', description: 'Settings' },
  ],
  defaultRedirect: '/messaging/',
};

/**
 * TikTok URL rules (nuclear option - block everything by default)
 */
export const TIKTOK_RULES: PlatformRules = {
  hosts: ['tiktok.com', 'www.tiktok.com'],
  patterns: [
    { pattern: '/**', mode: 'hard', redirect: 'blocked', description: 'All pages blocked' },
  ],
  defaultRedirect: 'blocked',
};

/**
 * All platform rules
 */
export const PLATFORM_RULES: Record<PlatformId, PlatformRules> = {
  twitter: TWITTER_RULES,
  reddit: REDDIT_RULES,
  youtube: YOUTUBE_RULES,
  instagram: INSTAGRAM_RULES,
  facebook: FACEBOOK_RULES,
  linkedin: LINKEDIN_RULES,
  tiktok: TIKTOK_RULES,
};

/**
 * Twitter selectors for soft blocking
 */
export const TWITTER_SELECTORS: PlatformSelectors = {
  forYouTab: {
    primary: '[data-testid="ScrollSnap-List"] [role="presentation"]:first-child',
    fallbacks: ['nav[role="navigation"] a[href="/home"]'],
    description: 'For You tab in timeline switcher',
  },
  trendsSidebar: {
    primary: '[data-testid="sidebarColumn"] [data-testid="trend"]',
    fallbacks: ['aside[aria-label*="Trends"]', '[aria-label*="Timeline: Trending"]'],
    description: 'Trending topics sidebar',
  },
  whoToFollow: {
    primary: '[data-testid="sidebarColumn"] [data-testid="UserCell"]',
    fallbacks: ['aside [aria-label*="Who to follow"]'],
    description: 'Who to follow suggestions',
  },
};

/**
 * YouTube selectors for soft blocking
 */
export const YOUTUBE_SELECTORS: PlatformSelectors = {
  recommendations: {
    primary: '#secondary ytd-watch-next-secondary-results-renderer',
    fallbacks: ['#related', '[data-testid="related-videos"]'],
    description: 'Video recommendations sidebar',
  },
  endCards: {
    primary: '.ytp-ce-element',
    fallbacks: ['.ytp-endscreen-content'],
    description: 'End screen suggestions',
  },
  shortsInFeed: {
    primary: 'ytd-reel-shelf-renderer',
    fallbacks: ['ytd-rich-section-renderer:has(ytd-reel-shelf-renderer)'],
    description: 'Shorts shelf in feed',
  },
  homeFeed: {
    primary: 'ytd-rich-grid-renderer',
    fallbacks: ['#contents.ytd-rich-grid-renderer'],
    description: 'Homepage video grid',
  },
};

/**
 * Facebook selectors for soft blocking
 */
export const FACEBOOK_SELECTORS: PlatformSelectors = {
  feed: {
    primary: '[role="feed"]',
    fallbacks: ['[data-pagelet="FeedUnit"]'],
    description: 'News feed',
  },
  stories: {
    primary: '[data-pagelet="Stories"]',
    fallbacks: ['[aria-label*="Stories"]'],
    description: 'Stories tray',
  },
  peopleYouMayKnow: {
    primary: '[data-pagelet="RightRail"] [aria-label*="People"]',
    fallbacks: [],
    description: 'People you may know suggestions',
  },
};

/**
 * LinkedIn selectors for soft blocking
 */
export const LINKEDIN_SELECTORS: PlatformSelectors = {
  feed: {
    primary: 'main.scaffold-layout__main',
    fallbacks: [
      '.scaffold-finite-scroll__content',
      '[data-finite-scroll-hotkey-context="FEED"]',
      '.feed-shared-update-v2',
      '[data-id^="urn:li:activity"]',
    ],
    description: 'Feed posts',
  },
  peopleYouMayKnow: {
    primary: '.mn-pymk-section',
    fallbacks: [
      '[data-test-id="people-you-may-know"]',
      '.feed-follows-module',
    ],
    description: 'People you may know suggestions',
  },
};

/**
 * All platform selectors
 */
export const PLATFORM_SELECTORS: Partial<Record<PlatformId, PlatformSelectors>> = {
  twitter: TWITTER_SELECTORS,
  youtube: YOUTUBE_SELECTORS,
  facebook: FACEBOOK_SELECTORS,
  linkedin: LINKEDIN_SELECTORS,
};

/**
 * Redirect options available for each platform
 */
export interface RedirectOption {
  value: string;
  label: string;
}

export const PLATFORM_REDIRECT_OPTIONS: Record<PlatformId, RedirectOption[]> = {
  twitter: [
    { value: 'blocked', label: 'Block page' },
    { value: 'following-tab', label: 'Following tab' },
    { value: '/i/chat', label: 'Messages' },
  ],
  reddit: [
    { value: 'blocked', label: 'Block page' },
  ],
  youtube: [
    { value: 'feed-block', label: 'Feed block' },
    { value: 'blocked', label: 'Block page' },
    { value: '/feed/subscriptions', label: 'Subscriptions' },
  ],
  instagram: [
    { value: 'blocked', label: 'Block page' },
    { value: '/direct/inbox/', label: 'Messages' },
  ],
  facebook: [
    { value: 'feed-block', label: 'Feed block' },
    { value: 'blocked', label: 'Block page' },
    { value: '/messages/', label: 'Messages' },
  ],
  linkedin: [
    { value: 'feed-block', label: 'Feed block' },
    { value: 'blocked', label: 'Block page' },
    { value: '/messaging/', label: 'Messages' },
  ],
  tiktok: [
    { value: 'blocked', label: 'Block page' },
    { value: '/following', label: 'Following' },
    { value: '/inbox', label: 'Messages' },
  ],
};
