import { describe, it, expect } from 'vitest';
import { DEFAULT_STORAGE } from '../../src/shared/config.js';
import {
  havePlatformSettingsChanged,
  normalizeTwitterListPath,
  shouldApplyYouTubeContentBlocking,
} from '../../src/shared/platform-settings.js';

describe('shouldApplyYouTubeContentBlocking', () => {
  it('returns false when globally disabled', () => {
    const config = {
      ...DEFAULT_STORAGE,
      globalEnabled: false,
    };

    expect(shouldApplyYouTubeContentBlocking(config)).toBe(false);
  });

  it('returns false when YouTube platform is disabled', () => {
    const config = {
      ...DEFAULT_STORAGE,
      platforms: {
        ...DEFAULT_STORAGE.platforms,
        youtube: {
          ...DEFAULT_STORAGE.platforms.youtube,
          enabled: false,
        },
      },
    };

    expect(shouldApplyYouTubeContentBlocking(config)).toBe(false);
  });

  it('returns false when redirect target is not feed-block', () => {
    const config = {
      ...DEFAULT_STORAGE,
      platforms: {
        ...DEFAULT_STORAGE.platforms,
        youtube: {
          ...DEFAULT_STORAGE.platforms.youtube,
          redirectTarget: '/feed/subscriptions',
        },
      },
    };

    expect(shouldApplyYouTubeContentBlocking(config)).toBe(false);
  });

  it('returns true when global and YouTube are enabled and redirect target is feed-block', () => {
    expect(shouldApplyYouTubeContentBlocking(DEFAULT_STORAGE)).toBe(true);
  });
});

describe('normalizeTwitterListPath', () => {
  it('normalizes raw list paths', () => {
    expect(normalizeTwitterListPath('/i/lists/123')).toBe('/i/lists/123');
    expect(normalizeTwitterListPath('i/lists/123')).toBe('/i/lists/123');
  });

  it('normalizes full x.com and twitter.com URLs', () => {
    expect(normalizeTwitterListPath('https://x.com/i/lists/123')).toBe('/i/lists/123');
    expect(normalizeTwitterListPath('https://twitter.com/myname/lists/reading')).toBe('/myname/lists/reading');
  });

  it('returns null for empty or non-list paths', () => {
    expect(normalizeTwitterListPath('')).toBeNull();
    expect(normalizeTwitterListPath('   ')).toBeNull();
    expect(normalizeTwitterListPath('/home')).toBeNull();
  });

  it('returns null for URLs from unsupported hosts', () => {
    expect(normalizeTwitterListPath('https://example.com/i/lists/123')).toBeNull();
  });
});

describe('havePlatformSettingsChanged', () => {
  it('detects global and current-platform changes', () => {
    const globallyDisabled = {
      ...DEFAULT_STORAGE,
      globalEnabled: false,
    };
    const youtubeDisabled = {
      ...DEFAULT_STORAGE,
      platforms: {
        ...DEFAULT_STORAGE.platforms,
        youtube: { ...DEFAULT_STORAGE.platforms.youtube, enabled: false },
      },
    };

    expect(havePlatformSettingsChanged('youtube', DEFAULT_STORAGE, globallyDisabled)).toBe(true);
    expect(havePlatformSettingsChanged('youtube', DEFAULT_STORAGE, youtubeDisabled)).toBe(true);
  });

  it('ignores stats and other-platform changes', () => {
    const statsChanged = {
      ...DEFAULT_STORAGE,
      stats: { blocksTotal: 1, lastBlock: 123 },
    };
    const twitterDisabled = {
      ...DEFAULT_STORAGE,
      platforms: {
        ...DEFAULT_STORAGE.platforms,
        twitter: { ...DEFAULT_STORAGE.platforms.twitter, enabled: false },
      },
    };

    expect(havePlatformSettingsChanged('youtube', DEFAULT_STORAGE, statsChanged)).toBe(false);
    expect(havePlatformSettingsChanged('youtube', DEFAULT_STORAGE, twitterDisabled)).toBe(false);
  });
});
