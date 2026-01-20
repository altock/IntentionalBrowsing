/**
 * Base content script functionality shared across all platforms
 */

import { Router, getRouter } from './router.js';
import type { BlockDecision, ExtensionMessage, ExtensionResponse, PlatformId, SelectorConfig } from '../shared/types.js';

/**
 * Send a message to the background script
 */
export async function sendMessage<T>(message: ExtensionMessage): Promise<ExtensionResponse<T>> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response: ExtensionResponse<T>) => {
      resolve(response || { success: false, error: 'No response' });
    });
  });
}

/**
 * Check if current URL should be blocked
 */
export async function checkCurrentUrl(): Promise<BlockDecision> {
  const response = await sendMessage<BlockDecision>({
    type: 'CHECK_URL',
    payload: window.location.href,
  });

  if (response.success && response.data) {
    return response.data;
  }

  return { shouldBlock: false, mode: 'allow' };
}

/**
 * Hide all elements matching a selector config
 */
export function hideAllElements(selectorConfig: SelectorConfig): number {
  let hiddenCount = 0;

  // Try primary selector
  const primaries = document.querySelectorAll(selectorConfig.primary);
  primaries.forEach((el) => {
    (el as HTMLElement).style.display = 'none';
    hiddenCount++;
  });

  if (hiddenCount > 0) {
    return hiddenCount;
  }

  // Try fallback selectors
  for (const fallback of selectorConfig.fallbacks) {
    const elements = document.querySelectorAll(fallback);
    elements.forEach((el) => {
      (el as HTMLElement).style.display = 'none';
      hiddenCount++;
    });

    if (hiddenCount > 0) {
      console.log(`[IntentionalBrowsing] Used fallback selector for ${selectorConfig.description}`);
      return hiddenCount;
    }
  }

  return hiddenCount;
}

/**
 * Set up a MutationObserver to continuously hide elements with debouncing
 */
export function observeAndHide(
  selectorConfigs: SelectorConfig[],
  container: Element = document.body
): MutationObserver {
  let scheduled = false;

  const hideElements = () => {
    scheduled = false;
    for (const config of selectorConfigs) {
      hideAllElements(config);
    }
  };

  const observer = new MutationObserver(() => {
    // Debounce using requestAnimationFrame
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(hideElements);
    }
  });

  observer.observe(container, {
    childList: true,
    subtree: true,
  });

  // Initial pass
  for (const config of selectorConfigs) {
    hideAllElements(config);
  }

  return observer;
}

/**
 * Base class for platform content scripts
 */
export abstract class PlatformContentScript {
  protected router: Router;
  protected observer: MutationObserver | null = null;
  protected platformId: PlatformId;

  constructor(platformId: PlatformId) {
    this.platformId = platformId;
    this.router = getRouter();
  }

  /**
   * Initialize the content script
   */
  async init(): Promise<void> {
    console.log(`[IntentionalBrowsing] Initializing ${this.platformId} content script`);

    // Initialize router
    this.router.init();

    // Check current URL
    const decision = await checkCurrentUrl();

    if (decision.shouldBlock) {
      if (decision.mode === 'soft') {
        // Apply soft blocks
        this.applySoftBlocks();
      }
      // Hard blocks are handled by background script
    }

    // Listen for SPA navigation to re-apply soft blocks
    // (hard blocks handled by background via webNavigation API)
    this.router.onLocationChange(async () => {
      const newDecision = await checkCurrentUrl();
      if (newDecision.shouldBlock && newDecision.mode === 'soft') {
        this.applySoftBlocks();
      }
    });

    // Set up continuous soft blocking with MutationObserver
    this.setupObserver();
  }

  /**
   * Apply soft blocks (DOM hiding)
   */
  protected abstract applySoftBlocks(): void;

  /**
   * Set up MutationObserver for continuous soft blocking
   */
  protected abstract setupObserver(): void;

  /**
   * Clean up
   */
  destroy(): void {
    this.router.destroy();
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}
