/**
 * Twitter/X Content Script
 *
 * Twitter uses hard blocks handled by background script.
 * This handles SPA navigation detection.
 */

import { PlatformContentScript } from '../base.js';

class TwitterContentScript extends PlatformContentScript {
  constructor() {
    super('twitter');
  }

  protected applySoftBlocks(): void {
    // Twitter uses hard blocks only
  }

  protected setupObserver(): void {
    // No soft blocks to observe
  }
}

const script = new TwitterContentScript();
script.init().catch(console.error);
