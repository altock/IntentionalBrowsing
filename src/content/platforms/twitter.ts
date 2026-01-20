/**
 * Twitter/X Content Script
 *
 * Handles:
 * - Blocking home/feed pages based on user settings
 * - Auto-clicking "Following" tab when that option is selected
 * - Redirecting to messages when that option is selected
 * - SPA navigation detection
 */

import { PlatformContentScript, sendMessage } from '../base.js';
import type { StorageSchema } from '../../shared/types.js';

class TwitterContentScript extends PlatformContentScript {
  private hasClickedFollowingTab = false;
  private hasHandledRedirect = false;

  constructor() {
    super('twitter');
  }

  async init(): Promise<void> {
    await super.init();

    // Check if we need to block/redirect
    await this.handleRedirect();

    // Also check on SPA navigation
    this.router.onLocationChange(async () => {
      this.hasClickedFollowingTab = false;
      this.hasHandledRedirect = false;
      await this.handleRedirect();
    });
  }

  private async handleRedirect(): Promise<void> {
    // Only on home page
    const path = window.location.pathname;
    if (path !== '/' && path !== '/home') {
      return;
    }

    // Prevent double-handling
    if (this.hasHandledRedirect) return;

    // Check config
    const response = await sendMessage<StorageSchema>({ type: 'GET_CONFIG' });
    if (!response.success || !response.data) return;

    const config = response.data;
    const twitterConfig = config.platforms.twitter;

    if (!config.globalEnabled || !twitterConfig.enabled) return;

    this.hasHandledRedirect = true;

    switch (twitterConfig.redirectTarget) {
      case 'blocked':
        // Redirect to blocked page
        window.location.href = chrome.runtime.getURL('/ui/blocked.html');
        break;
      case 'following-tab':
        // Auto-click Following tab
        this.waitForAndClickFollowingTab();
        break;
      case '/i/chat':
        // Redirect to messages
        window.location.href = 'https://x.com/messages';
        break;
    }
  }

  private waitForAndClickFollowingTab(): void {
    const maxAttempts = 20;
    let attempts = 0;

    const tryClick = () => {
      attempts++;

      // Try to find the Following tab
      // Twitter uses different selectors, try multiple approaches
      const followingTab = this.findFollowingTab();

      if (followingTab) {
        // Check if already on Following tab (has aria-selected="true" or similar indicator)
        const isSelected = followingTab.getAttribute('aria-selected') === 'true' ||
                          followingTab.closest('[aria-selected="true"]') !== null ||
                          followingTab.querySelector('[aria-selected="true"]') !== null;

        if (!isSelected) {
          console.log('[IntentionalBrowsing] Clicking Following tab');
          followingTab.click();
        }
        this.hasClickedFollowingTab = true;
        return;
      }

      if (attempts < maxAttempts) {
        setTimeout(tryClick, 200);
      }
    };

    tryClick();
  }

  private findFollowingTab(): HTMLElement | null {
    // Method 1: Find tab with "Following" text
    const tabs = document.querySelectorAll('[role="tab"]');
    for (const tab of tabs) {
      if (tab.textContent?.includes('Following')) {
        return tab as HTMLElement;
      }
    }

    // Method 2: Find link/button with "Following" text in the header area
    const headerTabs = document.querySelectorAll('[data-testid="ScrollSnap-List"] a, [role="tablist"] a');
    for (const tab of headerTabs) {
      if (tab.textContent?.includes('Following')) {
        return tab as HTMLElement;
      }
    }

    // Method 3: Look for the specific tab structure Twitter uses
    const allLinks = document.querySelectorAll('a[href="/home"]');
    for (const link of allLinks) {
      const text = link.textContent || '';
      if (text.includes('Following')) {
        return link as HTMLElement;
      }
    }

    return null;
  }

  protected applySoftBlocks(): void {
    // Twitter uses hard blocks primarily
  }

  protected setupObserver(): void {
    // No continuous soft blocks needed
  }
}

const script = new TwitterContentScript();
script.init().catch(console.error);
