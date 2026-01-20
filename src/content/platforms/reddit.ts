/**
 * Reddit Content Script
 *
 * Reddit uses hard blocks handled by background script.
 * This handles SPA navigation detection.
 */

import { PlatformContentScript } from '../base.js';

class RedditContentScript extends PlatformContentScript {
  constructor() {
    super('reddit');
  }

  protected applySoftBlocks(): void {
    // Reddit uses hard blocks only
  }

  protected setupObserver(): void {
    // No soft blocks to observe
  }
}

const script = new RedditContentScript();
script.init().catch(console.error);
