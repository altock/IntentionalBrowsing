/**
 * LinkedIn Content Script
 *
 * Handles soft blocks:
 * - Feed posts
 * - People you may know
 */

import { PlatformContentScript, hideAllElements, observeAndHide, sendMessage } from '../base.js';
import { LINKEDIN_SELECTORS } from '../../shared/config.js';
import type { SelectorConfig, StorageSchema } from '../../shared/types.js';

class LinkedInContentScript extends PlatformContentScript {
  private softBlockSelectors: SelectorConfig[] = [];

  constructor() {
    super('linkedin');
  }

  async init(): Promise<void> {
    // Load config to determine which soft blocks are enabled
    const response = await sendMessage<StorageSchema>({ type: 'GET_CONFIG' });
    const config = response.data;

    // Check if LinkedIn blocking is enabled at all
    if (!config?.globalEnabled || !config?.platforms.linkedin.enabled) {
      console.log('[IntentionalBrowsing] LinkedIn blocking is disabled');
      return;
    }

    const linkedinConfig = config.platforms.linkedin;

    // Only apply soft blocks if redirectTarget is 'feed-block'
    if (linkedinConfig.redirectTarget === 'feed-block' && this.isFeedPage()) {
      console.log('[IntentionalBrowsing] LinkedIn feed-block mode active');
      this.softBlockSelectors.push(LINKEDIN_SELECTORS.feed);
      if (linkedinConfig.softBlocks?.peopleYouMayKnow) {
        this.softBlockSelectors.push(LINKEDIN_SELECTORS.peopleYouMayKnow);
      }
    }

    await super.init();
  }

  private isFeedPage(): boolean {
    const path = window.location.pathname;
    return path === '/' || path === '/feed' || path.startsWith('/feed/');
  }

  protected applySoftBlocks(): void {
    for (const selector of this.softBlockSelectors) {
      const hidden = hideAllElements(selector);
      if (hidden > 0) {
        console.log(`[IntentionalBrowsing] Hidden ${hidden} ${selector.description}`);
      }
    }

    if (this.isFeedPage()) {
      this.addFeedMessage();
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
   * Add a message on the feed page
   */
  private addFeedMessage(): void {
    const containerId = 'intentional-browsing-message';
    if (document.getElementById(containerId)) {
      return;
    }

    const feed = document.querySelector('.scaffold-finite-scroll__content');
    if (!feed) return;

    const message = document.createElement('div');
    message.id = containerId;
    message.style.cssText = `
      text-align: center;
      padding: 40px 20px;
      color: rgba(0, 0, 0, 0.6);
      font-size: 14px;
      background: #fff;
      border-radius: 8px;
      margin: 8px 0;
      box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.08);
    `;
    message.innerHTML = `
      <p>Feed hidden.</p>
      <p><a href="/messaging/" style="color: #0a66c2;">Go to Messages</a></p>
    `;

    feed.parentElement?.insertBefore(message, feed);
  }
}

// Initialize
const script = new LinkedInContentScript();
script.init().catch(console.error);
