/**
 * Twitter/X Content Script
 *
 * Handles soft blocks:
 * - For You tab (redirect to Following)
 * - Trends sidebar
 * - Who to follow suggestions
 */

import { PlatformContentScript, hideAllElements, observeAndHide, sendMessage } from '../base.js';
import { TWITTER_SELECTORS } from '../../shared/config.js';
import type { SelectorConfig, StorageSchema } from '../../shared/types.js';

class TwitterContentScript extends PlatformContentScript {
  private softBlockSelectors: SelectorConfig[] = [];

  constructor() {
    super('twitter');
  }

  async init(): Promise<void> {
    // Load config to determine which soft blocks are enabled
    const response = await sendMessage<StorageSchema>({ type: 'GET_CONFIG' });
    const config = response.data;

    if (config?.platforms.twitter.softBlocks) {
      const softBlocks = config.platforms.twitter.softBlocks;

      if (softBlocks.trendsSidebar) {
        this.softBlockSelectors.push(TWITTER_SELECTORS.trendsSidebar);
      }
      if (softBlocks.whoToFollow) {
        this.softBlockSelectors.push(TWITTER_SELECTORS.whoToFollow);
      }
    }

    await super.init();

    // Handle For You tab redirect
    if (config?.platforms.twitter.softBlocks.forYouTab) {
      this.handleForYouTab();
    }
  }

  protected applySoftBlocks(): void {
    for (const selector of this.softBlockSelectors) {
      const hidden = hideAllElements(selector);
      if (hidden > 0) {
        console.log(`[IntentionalBrowsing] Hidden ${hidden} ${selector.description}`);
      }
    }
  }

  protected setupObserver(): void {
    if (this.softBlockSelectors.length === 0) {
      return;
    }

    // Wait for body to be available
    if (document.body) {
      this.observer = observeAndHide(this.softBlockSelectors, document.body);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        this.observer = observeAndHide(this.softBlockSelectors, document.body);
      });
    }
  }

  /**
   * Handle For You tab - click Following tab when detected
   */
  private handleForYouTab(): void {
    const checkAndRedirect = () => {
      // Check if we're on the home feed
      const path = window.location.pathname;
      if (path !== '/' && path !== '/home') {
        return;
      }

      // Look for the tab list
      const tabList = document.querySelector('[role="tablist"]');
      if (!tabList) return;

      // Find the For You and Following tabs
      const tabs = tabList.querySelectorAll('[role="tab"]');
      let forYouTab: Element | null = null;
      let followingTab: Element | null = null;

      tabs.forEach((tab) => {
        const text = tab.textContent?.toLowerCase() || '';
        if (text.includes('for you')) {
          forYouTab = tab;
        } else if (text.includes('following')) {
          followingTab = tab;
        }
      });

      // If For You is selected and Following exists, click Following
      if (forYouTab?.getAttribute('aria-selected') === 'true' && followingTab) {
        console.log('[IntentionalBrowsing] Redirecting from For You to Following tab');
        (followingTab as HTMLElement).click();
      }
    };

    // Run immediately and on DOM changes
    if (document.body) {
      checkAndRedirect();

      const observer = new MutationObserver(() => {
        checkAndRedirect();
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        checkAndRedirect();

        const observer = new MutationObserver(() => {
          checkAndRedirect();
        });

        observer.observe(document.body, {
          childList: true,
          subtree: true,
        });
      });
    }
  }
}

// Initialize
const script = new TwitterContentScript();
script.init().catch(console.error);
