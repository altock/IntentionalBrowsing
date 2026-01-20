/**
 * Instagram Content Script
 *
 * Handles soft blocks:
 * - Home feed (hide posts)
 * - Suggested posts
 * - Suggested follows
 */

import { PlatformContentScript, hideAllElements, observeAndHide, sendMessage } from '../base.js';
import { INSTAGRAM_SELECTORS } from '../../shared/config.js';
import type { SelectorConfig, StorageSchema } from '../../shared/types.js';

class InstagramContentScript extends PlatformContentScript {
  private softBlockSelectors: SelectorConfig[] = [];

  constructor() {
    super('instagram');
  }

  async init(): Promise<void> {
    // Load config to determine which soft blocks are enabled
    const response = await sendMessage<StorageSchema>({ type: 'GET_CONFIG' });
    const config = response.data;

    if (config?.platforms.instagram.softBlocks) {
      const softBlocks = config.platforms.instagram.softBlocks;

      if (softBlocks.feed && this.isHomepage()) {
        this.softBlockSelectors.push(INSTAGRAM_SELECTORS.feed);
      }
      if (softBlocks.suggestedPosts) {
        this.softBlockSelectors.push(INSTAGRAM_SELECTORS.suggestedPosts);
      }
      if (softBlocks.suggestedFollows) {
        this.softBlockSelectors.push(INSTAGRAM_SELECTORS.suggestedFollows);
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

    // If on homepage with feed blocking, add a message
    if (this.isHomepage() && this.softBlockSelectors.some(s => s === INSTAGRAM_SELECTORS.feed)) {
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
   * Add a subtle message on the homepage
   */
  private addHomepageMessage(): void {
    const containerId = 'intentional-browsing-message';
    if (document.getElementById(containerId)) {
      return;
    }

    const main = document.querySelector('main[role="main"]');
    if (!main) return;

    const message = document.createElement('div');
    message.id = containerId;
    message.style.cssText = `
      text-align: center;
      padding: 40px 20px;
      color: #8e8e8e;
      font-size: 14px;
    `;
    message.innerHTML = `
      <p>Feed hidden.</p>
      <p><a href="/direct/inbox/" style="color: #0095f6;">Go to Messages</a></p>
    `;

    main.prepend(message);
  }
}

// Initialize
const script = new InstagramContentScript();
script.init().catch(console.error);
