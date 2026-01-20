/**
 * SPA Router - Detects navigation changes in single-page applications
 *
 * Works by:
 * 1. Patching history.pushState and history.replaceState
 * 2. Listening for popstate events
 * 3. Optionally using MutationObserver on document title as a fallback
 */

export type LocationChangeCallback = (url: string) => void;

export class Router {
  private listeners: Set<LocationChangeCallback> = new Set();
  private lastUrl: string = '';
  private originalPushState: typeof history.pushState | null = null;
  private originalReplaceState: typeof history.replaceState | null = null;
  private popstateHandler: ((event: PopStateEvent) => void) | null = null;
  private titleObserver: MutationObserver | null = null;

  /**
   * Initialize the router and start listening for navigation changes
   * @returns The current URL
   */
  init(): string {
    this.lastUrl = window.location.href;

    // Patch history methods
    this.patchHistory();

    // Listen for popstate (back/forward navigation)
    this.popstateHandler = () => this.handleNavigation();
    window.addEventListener('popstate', this.popstateHandler);

    // Optional: Watch for title changes as fallback for some SPAs
    this.setupTitleObserver();

    return this.lastUrl;
  }

  /**
   * Patch history.pushState and history.replaceState to detect SPA navigation
   */
  private patchHistory(): void {
    // Save original methods
    this.originalPushState = history.pushState;
    this.originalReplaceState = history.replaceState;

    // Patch pushState
    history.pushState = (...args: Parameters<typeof history.pushState>) => {
      this.originalPushState!.apply(history, args);
      this.handleNavigation();
    };

    // Patch replaceState
    history.replaceState = (...args: Parameters<typeof history.replaceState>) => {
      this.originalReplaceState!.apply(history, args);
      this.handleNavigation();
    };
  }

  /**
   * Set up a MutationObserver to watch for title changes
   * Some SPAs update the title on navigation, which we can use as a fallback
   */
  private setupTitleObserver(): void {
    const titleElement = document.querySelector('title');
    if (!titleElement) return;

    this.titleObserver = new MutationObserver(() => {
      // Check if URL actually changed
      if (window.location.href !== this.lastUrl) {
        this.handleNavigation();
      }
    });

    this.titleObserver.observe(titleElement, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  /**
   * Handle a navigation event
   */
  private handleNavigation(): void {
    const currentUrl = window.location.href;

    // Only notify if URL actually changed
    if (currentUrl === this.lastUrl) {
      return;
    }

    this.lastUrl = currentUrl;

    // Notify all listeners
    for (const callback of this.listeners) {
      try {
        callback(currentUrl);
      } catch (error) {
        console.error('[IntentionalBrowsing] Router callback error:', error);
      }
    }
  }

  /**
   * Register a callback to be called when the URL changes
   */
  onLocationChange(callback: LocationChangeCallback): void {
    this.listeners.add(callback);
  }

  /**
   * Remove a previously registered callback
   */
  removeListener(callback: LocationChangeCallback): void {
    this.listeners.delete(callback);
  }

  /**
   * Get the current URL
   */
  getCurrentUrl(): string {
    return this.lastUrl || window.location.href;
  }

  /**
   * Redirect to a new URL
   */
  redirect(url: string): void {
    window.location.href = url;
  }

  /**
   * Clean up and restore original behavior
   */
  destroy(): void {
    // Restore original history methods
    if (this.originalPushState) {
      history.pushState = this.originalPushState;
    }
    if (this.originalReplaceState) {
      history.replaceState = this.originalReplaceState;
    }

    // Remove event listener
    if (this.popstateHandler) {
      window.removeEventListener('popstate', this.popstateHandler);
    }

    // Disconnect title observer
    if (this.titleObserver) {
      this.titleObserver.disconnect();
    }

    // Clear all listeners
    this.listeners.clear();
  }
}

/**
 * Singleton instance for content scripts
 */
let routerInstance: Router | null = null;

export function getRouter(): Router {
  if (!routerInstance) {
    routerInstance = new Router();
  }
  return routerInstance;
}
