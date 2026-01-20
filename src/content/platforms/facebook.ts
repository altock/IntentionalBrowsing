/**
 * Facebook Content Script
 *
 * Handles soft blocks:
 * - News feed
 * - Stories
 * - People you may know
 */

import { PlatformContentScript, hideAllElements, observeAndHide, sendMessage } from '../base.js';
import { FACEBOOK_SELECTORS } from '../../shared/config.js';
import type { SelectorConfig, StorageSchema } from '../../shared/types.js';

class FacebookContentScript extends PlatformContentScript {
  private softBlockSelectors: SelectorConfig[] = [];

  constructor() {
    super('facebook');
  }

  async init(): Promise<void> {
    // Load config to determine which soft blocks are enabled
    const response = await sendMessage<StorageSchema>({ type: 'GET_CONFIG' });
    const config = response.data;

    // Check if Facebook blocking is enabled at all
    if (!config?.platforms.facebook.enabled) {
      console.log('[IntentionalBrowsing] Facebook blocking is disabled');
      return;
    }

    if (config?.platforms.facebook.softBlocks) {
      const softBlocks = config.platforms.facebook.softBlocks;

      if (softBlocks.feed && this.isHomepage()) {
        this.softBlockSelectors.push(FACEBOOK_SELECTORS.feed);
      }
      if (softBlocks.stories) {
        this.softBlockSelectors.push(FACEBOOK_SELECTORS.stories);
      }
      if (softBlocks.peopleYouMayKnow) {
        this.softBlockSelectors.push(FACEBOOK_SELECTORS.peopleYouMayKnow);
      }
    }

    await super.init();
  }

  private isHomepage(): boolean {
    return window.location.pathname === '/' || window.location.pathname === '';
  }

  protected applySoftBlocks(): void {
    for (const selector of this.softBlockSelectors) {
      const hidden = hideAllElements(selector);
      if (hidden > 0) {
        console.log(`[IntentionalBrowsing] Hidden ${hidden} ${selector.description}`);
      }
    }

    if (this.isHomepage()) {
      this.addHomepageMessage();
    }
  }

  protected setupObserver(): void {
    if (this.softBlockSelectors.length === 0) {
      return;
    }

    if (document.body) {
      this.observer = observeAndHide(this.softBlockSelectors, document.body);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        this.observer = observeAndHide(this.softBlockSelectors, document.body);
      });
    }
  }

  /**
   * Add a message on the homepage
   */
  private addHomepageMessage(): void {
    const containerId = 'intentional-browsing-message';
    if (document.getElementById(containerId)) {
      return;
    }

    const feed = document.querySelector('[role="feed"]');
    if (!feed) return;

    const message = document.createElement('div');
    message.id = containerId;
    message.style.cssText = `
      text-align: center;
      padding: 40px 20px;
      color: #65676b;
      font-size: 14px;
      background: #f0f2f5;
      border-radius: 8px;
      margin: 16px;
    `;
    message.innerHTML = `
      <p>News Feed hidden.</p>
      <p><a href="/messages/" style="color: #1877f2;">Go to Messages</a></p>
    `;

    feed.parentElement?.insertBefore(message, feed);
  }
}

// Initialize
const script = new FacebookContentScript();
script.init().catch(console.error);
