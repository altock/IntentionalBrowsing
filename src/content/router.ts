/**
 * SPA Router - Detects navigation changes in single-page applications
 *
 * Works by patching history.pushState/replaceState and listening for popstate.
 */

export type LocationChangeCallback = (url: string) => void;

export class Router {
  private listeners: Set<LocationChangeCallback> = new Set();
  private lastUrl: string = '';
  private originalPushState: typeof history.pushState | null = null;
  private originalReplaceState: typeof history.replaceState | null = null;
  private popstateHandler: ((event: PopStateEvent) => void) | null = null;

  init(): string {
    this.lastUrl = window.location.href;
    this.patchHistory();
    this.popstateHandler = () => this.handleNavigation();
    window.addEventListener('popstate', this.popstateHandler);
    return this.lastUrl;
  }

  private patchHistory(): void {
    this.originalPushState = history.pushState;
    this.originalReplaceState = history.replaceState;

    history.pushState = (...args: Parameters<typeof history.pushState>) => {
      this.originalPushState!.apply(history, args);
      this.handleNavigation();
    };

    history.replaceState = (...args: Parameters<typeof history.replaceState>) => {
      this.originalReplaceState!.apply(history, args);
      this.handleNavigation();
    };
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

  destroy(): void {
    if (this.originalPushState) {
      history.pushState = this.originalPushState;
    }
    if (this.originalReplaceState) {
      history.replaceState = this.originalReplaceState;
    }
    if (this.popstateHandler) {
      window.removeEventListener('popstate', this.popstateHandler);
    }
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
