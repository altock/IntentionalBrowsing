/**
 * YouTube Content Script
 *
 * Handles soft blocks:
 * - Homepage recommendations (show only search)
 * - Sidebar recommendations on watch pages
 * - End screen suggestions
 * - Shorts in feed
 * - Autoplay toggle
 */

import { PlatformContentScript, hideAllElements, observeAndHide, sendMessage } from '../base.js';
import { YOUTUBE_SELECTORS } from '../../shared/config.js';
import type { SelectorConfig, StorageSchema, YouTubeCustomSettings } from '../../shared/types.js';

class YouTubeContentScript extends PlatformContentScript {
  private softBlockSelectors: SelectorConfig[] = [];
  private disableAutoplay = true;
  private shortsRedirectToWatch = true;

  constructor() {
    super('youtube');
  }

  async init(): Promise<void> {
    // Load config to determine which soft blocks are enabled
    const response = await sendMessage<StorageSchema>({ type: 'GET_CONFIG' });
    const config = response.data;

    if (config?.platforms.youtube.softBlocks) {
      const softBlocks = config.platforms.youtube.softBlocks;

      if (softBlocks.recommendations) {
        this.softBlockSelectors.push(YOUTUBE_SELECTORS.recommendations);
      }
      if (softBlocks.endCards) {
        this.softBlockSelectors.push(YOUTUBE_SELECTORS.endCards);
      }
      if (softBlocks.shortsInFeed) {
        this.softBlockSelectors.push(YOUTUBE_SELECTORS.shortsInFeed);
      }
    }

    // Check custom settings
    const customSettings = config?.platforms.youtube.customSettings as YouTubeCustomSettings | undefined;
    this.disableAutoplay = customSettings?.disableAutoplay ?? true;
    this.shortsRedirectToWatch = customSettings?.shortsRedirectToWatch ?? true;

    await super.init();

    // Soft block homepage feed if on homepage
    if (this.isHomepage()) {
      this.softBlockHomepage();
    }

    // Handle autoplay
    if (this.disableAutoplay) {
      this.disableAutoplayToggle();
    }

    // Handle shorts redirect
    if (this.shortsRedirectToWatch) {
      this.handleShortsRedirect();
    }
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

    // Re-apply homepage soft block if needed
    if (this.isHomepage()) {
      this.softBlockHomepage();
    }
  }

  protected setupObserver(): void {
    const waitForBody = () => {
      if (this.softBlockSelectors.length > 0) {
        this.observer = observeAndHide(this.softBlockSelectors, document.body);
      }

      // Also observe for homepage
      if (this.isHomepage()) {
        const homepageObserver = new MutationObserver(() => {
          this.softBlockHomepage();
        });
        homepageObserver.observe(document.body, {
          childList: true,
          subtree: true,
        });
      }
    };

    if (document.body) {
      waitForBody();
    } else {
      document.addEventListener('DOMContentLoaded', waitForBody);
    }
  }

  /**
   * Soft block the homepage - hide the video grid but keep search
   */
  private softBlockHomepage(): void {
    // Hide the main feed
    const hidden = hideAllElements(YOUTUBE_SELECTORS.homeFeed);
    if (hidden > 0) {
      console.log('[IntentionalBrowsing] Hidden homepage feed');
    }

    // Add a message to encourage using subscriptions
    this.addHomepageMessage();
  }

  /**
   * Add a subtle message on the homepage
   */
  private addHomepageMessage(): void {
    const containerId = 'intentional-browsing-message';
    if (document.getElementById(containerId)) {
      return; // Already added
    }

    const container = document.querySelector('#contents.ytd-rich-grid-renderer')?.parentElement;
    if (!container) return;

    const message = document.createElement('div');
    message.id = containerId;
    message.style.cssText = `
      text-align: center;
      padding: 40px 20px;
      color: var(--yt-spec-text-secondary, #606060);
      font-size: 14px;
    `;
    message.innerHTML = `
      <p>Homepage recommendations hidden.</p>
      <p><a href="/feed/subscriptions" style="color: var(--yt-spec-call-to-action, #065fd4);">Go to Subscriptions</a></p>
    `;

    container.prepend(message);
  }

  /**
   * Disable autoplay toggle
   */
  private disableAutoplayToggle(): void {
    const checkAutoplay = () => {
      // Find the autoplay toggle
      const toggle = document.querySelector('.ytp-autonav-toggle-button');
      if (toggle && toggle.getAttribute('aria-checked') === 'true') {
        (toggle as HTMLElement).click();
        console.log('[IntentionalBrowsing] Disabled autoplay');
      }
    };

    // Check immediately and on navigation
    if (document.body) {
      setTimeout(checkAutoplay, 1000);
    }

    document.addEventListener('yt-navigate-finish', () => {
      setTimeout(checkAutoplay, 1000);
    });
  }

  /**
   * Handle Shorts redirect to regular video
   */
  private handleShortsRedirect(): void {
    // This is mostly handled by hard block in background,
    // but we can intercept clicks to shorts within the page
    document.addEventListener('click', (event) => {
      const link = (event.target as Element).closest('a[href*="/shorts/"]');
      if (link) {
        const href = link.getAttribute('href');
        if (href) {
          const shortId = href.split('/shorts/')[1]?.split(/[?/]/)[0];
          if (shortId) {
            event.preventDefault();
            event.stopPropagation();
            window.location.href = `/watch?v=${shortId}`;
            console.log(`[IntentionalBrowsing] Redirected short ${shortId} to watch page`);
          }
        }
      }
    }, true);
  }
}

// Initialize
const script = new YouTubeContentScript();
script.init().catch(console.error);
