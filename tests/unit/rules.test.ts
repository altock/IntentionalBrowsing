import { describe, it, expect } from 'vitest';
import {
  matchPattern,
  getPlatformFromUrl,
  checkUrl,
  getBlockDecision,
} from '../../src/shared/rules.js';
import { DEFAULT_STORAGE } from '../../src/shared/config.js';

describe('matchPattern', () => {
  describe('exact matches', () => {
    it('should match exact path', () => {
      expect(matchPattern('/', '/')).toBe(true);
      expect(matchPattern('/home', '/home')).toBe(true);
      expect(matchPattern('/messages', '/messages')).toBe(true);
    });

    it('should not match different exact paths', () => {
      expect(matchPattern('/', '/home')).toBe(false);
      expect(matchPattern('/home', '/')).toBe(false);
      expect(matchPattern('/messages', '/notifications')).toBe(false);
    });
  });

  describe('single wildcard (*)', () => {
    it('should match single segment wildcard', () => {
      expect(matchPattern('/user/*', '/user/john')).toBe(true);
      expect(matchPattern('/r/*', '/r/programming')).toBe(true);
      expect(matchPattern('/*/status/*', '/john/status/123')).toBe(true);
    });

    it('should not match multiple segments with single wildcard', () => {
      expect(matchPattern('/user/*', '/user/john/posts')).toBe(false);
      expect(matchPattern('/r/*', '/r/programming/comments')).toBe(false);
    });

    it('should handle wildcards at different positions', () => {
      expect(matchPattern('/*', '/anything')).toBe(true);
      expect(matchPattern('/prefix/*', '/prefix/value')).toBe(true);
      expect(matchPattern('/*/suffix', '/value/suffix')).toBe(true);
    });
  });

  describe('double wildcard (**)', () => {
    it('should match zero or more segments', () => {
      expect(matchPattern('/explore/**', '/explore')).toBe(true);
      expect(matchPattern('/explore/**', '/explore/')).toBe(true);
      expect(matchPattern('/explore/**', '/explore/tabs')).toBe(true);
      expect(matchPattern('/explore/**', '/explore/tabs/for-you')).toBe(true);
    });

    it('should match entire path', () => {
      expect(matchPattern('/**', '/')).toBe(true);
      expect(matchPattern('/**', '/anything')).toBe(true);
      expect(matchPattern('/**', '/deep/nested/path')).toBe(true);
    });

    it('should match after prefix', () => {
      expect(matchPattern('/r/*/comments/**', '/r/test/comments/123/title')).toBe(true);
      expect(matchPattern('/user/**', '/user/john/posts/recent')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle trailing slashes', () => {
      expect(matchPattern('/', '/')).toBe(true);
      expect(matchPattern('/home', '/home/')).toBe(true);
      expect(matchPattern('/home/', '/home')).toBe(true);
    });

    it('should handle empty segments', () => {
      expect(matchPattern('/messages', '/messages')).toBe(true);
      expect(matchPattern('/messages/', '/messages/')).toBe(true);
    });

    it('should handle query strings (ignore them)', () => {
      // Pattern matching should work on path only
      expect(matchPattern('/watch', '/watch?v=123')).toBe(true);
      expect(matchPattern('/results', '/results?search_query=test')).toBe(true);
    });
  });
});

describe('getPlatformFromUrl', () => {
  it('should detect Twitter from various domains', () => {
    expect(getPlatformFromUrl('https://twitter.com/home')).toBe('twitter');
    expect(getPlatformFromUrl('https://www.twitter.com/home')).toBe('twitter');
    expect(getPlatformFromUrl('https://x.com/home')).toBe('twitter');
    expect(getPlatformFromUrl('https://www.x.com/')).toBe('twitter');
    expect(getPlatformFromUrl('https://mobile.twitter.com/')).toBe('twitter');
  });

  it('should detect Reddit from various domains', () => {
    expect(getPlatformFromUrl('https://reddit.com/')).toBe('reddit');
    expect(getPlatformFromUrl('https://www.reddit.com/r/programming')).toBe('reddit');
    expect(getPlatformFromUrl('https://old.reddit.com/r/test')).toBe('reddit');
    expect(getPlatformFromUrl('https://new.reddit.com/')).toBe('reddit');
  });

  it('should detect YouTube', () => {
    expect(getPlatformFromUrl('https://youtube.com/')).toBe('youtube');
    expect(getPlatformFromUrl('https://www.youtube.com/watch?v=123')).toBe('youtube');
    expect(getPlatformFromUrl('https://m.youtube.com/shorts/abc')).toBe('youtube');
  });

  it('should detect Instagram', () => {
    expect(getPlatformFromUrl('https://instagram.com/')).toBe('instagram');
    expect(getPlatformFromUrl('https://www.instagram.com/explore')).toBe('instagram');
  });

  it('should detect Facebook', () => {
    expect(getPlatformFromUrl('https://facebook.com/')).toBe('facebook');
    expect(getPlatformFromUrl('https://www.facebook.com/watch')).toBe('facebook');
    expect(getPlatformFromUrl('https://m.facebook.com/')).toBe('facebook');
  });

  it('should detect LinkedIn', () => {
    expect(getPlatformFromUrl('https://linkedin.com/feed')).toBe('linkedin');
    expect(getPlatformFromUrl('https://www.linkedin.com/in/someone')).toBe('linkedin');
  });

  it('should detect TikTok', () => {
    expect(getPlatformFromUrl('https://tiktok.com/')).toBe('tiktok');
    expect(getPlatformFromUrl('https://www.tiktok.com/@user')).toBe('tiktok');
  });

  it('should return null for unknown domains', () => {
    expect(getPlatformFromUrl('https://google.com/')).toBeNull();
    expect(getPlatformFromUrl('https://github.com/')).toBeNull();
    expect(getPlatformFromUrl('https://example.com/')).toBeNull();
  });
});

describe('checkUrl', () => {
  describe('Twitter', () => {
    it('should block home feed', () => {
      const result = checkUrl('https://twitter.com/');
      expect(result.shouldBlock).toBe(true);
      expect(result.mode).toBe('hard');
      expect(result.redirectUrl).toBe('blocked');
    });

    it('should block /home', () => {
      const result = checkUrl('https://twitter.com/home');
      expect(result.shouldBlock).toBe(true);
      expect(result.mode).toBe('hard');
    });

    it('should allow explore', () => {
      const result = checkUrl('https://x.com/explore');
      expect(result.shouldBlock).toBe(false);
      expect(result.mode).toBe('allow');
    });

    it('should allow messages', () => {
      const result = checkUrl('https://twitter.com/messages');
      expect(result.shouldBlock).toBe(false);
      expect(result.mode).toBe('allow');
    });

    it('should allow search', () => {
      const result = checkUrl('https://twitter.com/search?q=test');
      expect(result.shouldBlock).toBe(false);
    });

    it('should allow notifications', () => {
      const result = checkUrl('https://twitter.com/notifications');
      expect(result.shouldBlock).toBe(false);
    });

    it('should allow user profiles', () => {
      const result = checkUrl('https://twitter.com/elonmusk');
      expect(result.shouldBlock).toBe(false);
    });

    it('should allow individual tweets', () => {
      const result = checkUrl('https://twitter.com/user/status/123456');
      expect(result.shouldBlock).toBe(false);
    });
  });

  describe('Reddit', () => {
    it('should block home feed', () => {
      const result = checkUrl('https://reddit.com/');
      expect(result.shouldBlock).toBe(true);
      expect(result.mode).toBe('hard');
    });

    it('should block /popular', () => {
      const result = checkUrl('https://www.reddit.com/popular');
      expect(result.shouldBlock).toBe(true);
    });

    it('should block /r/all', () => {
      const result = checkUrl('https://reddit.com/r/all');
      expect(result.shouldBlock).toBe(true);
    });

    it('should block /all', () => {
      const result = checkUrl('https://reddit.com/all');
      expect(result.shouldBlock).toBe(true);
    });

    it('should allow subreddits', () => {
      const result = checkUrl('https://reddit.com/r/programming');
      expect(result.shouldBlock).toBe(false);
    });

    it('should allow comments', () => {
      const result = checkUrl('https://reddit.com/r/test/comments/abc123/title');
      expect(result.shouldBlock).toBe(false);
    });

    it('should allow search', () => {
      const result = checkUrl('https://reddit.com/search?q=test');
      expect(result.shouldBlock).toBe(false);
    });

    it('should allow user profiles', () => {
      const result = checkUrl('https://reddit.com/user/someone');
      expect(result.shouldBlock).toBe(false);
    });
  });

  describe('YouTube', () => {
    it('should soft block home page', () => {
      const result = checkUrl('https://youtube.com/');
      expect(result.shouldBlock).toBe(true);
      expect(result.mode).toBe('soft');
    });

    it('should block /shorts tab', () => {
      const result = checkUrl('https://www.youtube.com/shorts');
      expect(result.shouldBlock).toBe(true);
      expect(result.mode).toBe('hard');
    });

    it('should redirect individual shorts to watch', () => {
      const result = checkUrl('https://youtube.com/shorts/abc123');
      expect(result.shouldBlock).toBe(true);
      expect(result.redirectUrl).toBe('shorts-redirect');
    });

    it('should block trending', () => {
      const result = checkUrl('https://youtube.com/feed/trending');
      expect(result.shouldBlock).toBe(true);
    });

    it('should allow subscriptions', () => {
      const result = checkUrl('https://youtube.com/feed/subscriptions');
      expect(result.shouldBlock).toBe(false);
    });

    it('should allow watch pages', () => {
      const result = checkUrl('https://youtube.com/watch?v=dQw4w9WgXcQ');
      expect(result.shouldBlock).toBe(false);
    });

    it('should allow search results', () => {
      const result = checkUrl('https://youtube.com/results?search_query=test');
      expect(result.shouldBlock).toBe(false);
    });

    it('should allow channel pages', () => {
      const result = checkUrl('https://youtube.com/@MrBeast');
      expect(result.shouldBlock).toBe(false);
    });
  });

  describe('Instagram', () => {
    it('should hard block home feed and redirect to messages', () => {
      const result = checkUrl('https://instagram.com/');
      expect(result.shouldBlock).toBe(true);
      expect(result.mode).toBe('hard');
      expect(result.redirectUrl).toBe('/direct/inbox/');
    });

    it('should block explore', () => {
      const result = checkUrl('https://www.instagram.com/explore');
      expect(result.shouldBlock).toBe(true);
      expect(result.mode).toBe('hard');
    });

    it('should block reels', () => {
      const result = checkUrl('https://instagram.com/reels');
      expect(result.shouldBlock).toBe(true);
    });

    it('should allow DMs', () => {
      const result = checkUrl('https://instagram.com/direct/inbox');
      expect(result.shouldBlock).toBe(false);
    });

    it('should allow posts', () => {
      const result = checkUrl('https://instagram.com/p/abc123');
      expect(result.shouldBlock).toBe(false);
    });

    it('should allow profiles', () => {
      const result = checkUrl('https://instagram.com/natgeo');
      expect(result.shouldBlock).toBe(false);
    });
  });

  describe('TikTok (nuclear option)', () => {
    it('should block everything', () => {
      expect(checkUrl('https://tiktok.com/').shouldBlock).toBe(true);
      expect(checkUrl('https://www.tiktok.com/@user').shouldBlock).toBe(true);
      expect(checkUrl('https://tiktok.com/foryou').shouldBlock).toBe(true);
    });
  });

  describe('Unknown platforms', () => {
    it('should allow unknown domains', () => {
      const result = checkUrl('https://google.com/');
      expect(result.shouldBlock).toBe(false);
      expect(result.mode).toBe('allow');
    });
  });
});

describe('getBlockDecision', () => {
  it('should respect global disabled state', () => {
    const config = {
      ...DEFAULT_STORAGE,
      globalEnabled: false,
    };
    const result = getBlockDecision('https://twitter.com/', config);
    expect(result.shouldBlock).toBe(false);
    expect(result.reason).toContain('globally disabled');
  });

  it('should respect platform disabled state', () => {
    const config = {
      ...DEFAULT_STORAGE,
      platforms: {
        ...DEFAULT_STORAGE.platforms,
        twitter: { ...DEFAULT_STORAGE.platforms.twitter, enabled: false },
      },
    };
    const result = getBlockDecision('https://twitter.com/', config);
    expect(result.shouldBlock).toBe(false);
    expect(result.reason).toContain('disabled');
  });

  it('should block when enabled', () => {
    const result = getBlockDecision('https://twitter.com/', DEFAULT_STORAGE);
    expect(result.shouldBlock).toBe(true);
    expect(result.mode).toBe('hard');
  });

  it('should respect hard block settings', () => {
    const config = {
      ...DEFAULT_STORAGE,
      platforms: {
        ...DEFAULT_STORAGE.platforms,
        twitter: {
          ...DEFAULT_STORAGE.platforms.twitter,
          hardBlocks: { home: false },
        },
      },
    };

    // Home should be allowed when disabled in config
    expect(getBlockDecision('https://twitter.com/', config).shouldBlock).toBe(false);
    // Messages should always be allowed
    expect(getBlockDecision('https://twitter.com/messages', config).shouldBlock).toBe(false);
  });
});
