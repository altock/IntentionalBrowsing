import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Router } from '../../src/content/router.js';

describe('Router', () => {
  let router: Router;
  let originalPushState: typeof history.pushState;
  let originalReplaceState: typeof history.replaceState;

  beforeEach(() => {
    // Save original methods
    originalPushState = history.pushState;
    originalReplaceState = history.replaceState;

    // Set up initial location
    Object.defineProperty(window, 'location', {
      value: {
        href: 'https://twitter.com/home',
        pathname: '/home',
        hostname: 'twitter.com',
        origin: 'https://twitter.com',
      },
      writable: true,
    });

    router = new Router();
  });

  afterEach(() => {
    router.destroy();
    // Restore original methods
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
  });

  describe('init', () => {
    it('should patch history.pushState', () => {
      router.init();

      // The method should be wrapped
      expect(history.pushState).not.toBe(originalPushState);
    });

    it('should patch history.replaceState', () => {
      router.init();

      expect(history.replaceState).not.toBe(originalReplaceState);
    });

    it('should return current URL on init', () => {
      const url = router.init();

      expect(url).toBe('https://twitter.com/home');
    });
  });

  describe('onLocationChange', () => {
    it('should call callback on pushState', () => {
      const callback = vi.fn();
      router.init();
      router.onLocationChange(callback);

      // Update location mock
      Object.defineProperty(window, 'location', {
        value: {
          href: 'https://twitter.com/messages',
          pathname: '/messages',
          hostname: 'twitter.com',
          origin: 'https://twitter.com',
        },
        writable: true,
      });

      // Trigger pushState
      history.pushState({}, '', '/messages');

      expect(callback).toHaveBeenCalledWith('https://twitter.com/messages');
    });

    it('should call callback on replaceState', () => {
      const callback = vi.fn();
      router.init();
      router.onLocationChange(callback);

      Object.defineProperty(window, 'location', {
        value: {
          href: 'https://twitter.com/notifications',
          pathname: '/notifications',
          hostname: 'twitter.com',
          origin: 'https://twitter.com',
        },
        writable: true,
      });

      history.replaceState({}, '', '/notifications');

      expect(callback).toHaveBeenCalledWith('https://twitter.com/notifications');
    });

    it('should call callback on popstate', () => {
      const callback = vi.fn();
      router.init();
      router.onLocationChange(callback);

      Object.defineProperty(window, 'location', {
        value: {
          href: 'https://twitter.com/explore',
          pathname: '/explore',
          hostname: 'twitter.com',
          origin: 'https://twitter.com',
        },
        writable: true,
      });

      // Simulate popstate event
      window.dispatchEvent(new PopStateEvent('popstate'));

      expect(callback).toHaveBeenCalledWith('https://twitter.com/explore');
    });

    it('should not call callback if URL has not changed', () => {
      const callback = vi.fn();
      router.init();
      router.onLocationChange(callback);

      // URL stays the same
      history.pushState({}, '', '/home');

      expect(callback).not.toHaveBeenCalled();
    });

    it('should support multiple callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      router.init();
      router.onLocationChange(callback1);
      router.onLocationChange(callback2);

      Object.defineProperty(window, 'location', {
        value: {
          href: 'https://twitter.com/messages',
          pathname: '/messages',
          hostname: 'twitter.com',
          origin: 'https://twitter.com',
        },
        writable: true,
      });

      history.pushState({}, '', '/messages');

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe('removeListener', () => {
    it('should remove a specific callback', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      router.init();
      router.onLocationChange(callback1);
      router.onLocationChange(callback2);

      router.removeListener(callback1);

      Object.defineProperty(window, 'location', {
        value: {
          href: 'https://twitter.com/messages',
          pathname: '/messages',
          hostname: 'twitter.com',
          origin: 'https://twitter.com',
        },
        writable: true,
      });

      history.pushState({}, '', '/messages');

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe('getCurrentUrl', () => {
    it('should return current URL', () => {
      router.init();

      expect(router.getCurrentUrl()).toBe('https://twitter.com/home');
    });
  });

  describe('destroy', () => {
    it('should restore original history methods', () => {
      router.init();

      expect(history.pushState).not.toBe(originalPushState);

      router.destroy();

      expect(history.pushState).toBe(originalPushState);
      expect(history.replaceState).toBe(originalReplaceState);
    });

    it('should remove all listeners', () => {
      const callback = vi.fn();
      router.init();
      router.onLocationChange(callback);

      router.destroy();

      // Re-init to patch methods again for this test
      router = new Router();
      router.init();

      Object.defineProperty(window, 'location', {
        value: {
          href: 'https://twitter.com/messages',
          pathname: '/messages',
          hostname: 'twitter.com',
          origin: 'https://twitter.com',
        },
        writable: true,
      });

      history.pushState({}, '', '/messages');

      // Old callback should not be called
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('redirect', () => {
    it('should redirect to a new URL', () => {
      router.init();

      // Mock location.href setter
      const hrefSetter = vi.fn();
      Object.defineProperty(window.location, 'href', {
        set: hrefSetter,
        get: () => 'https://twitter.com/home',
      });

      router.redirect('/messages');

      expect(hrefSetter).toHaveBeenCalledWith('/messages');
    });
  });
});
