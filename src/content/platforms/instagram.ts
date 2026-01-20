/**
 * Instagram Content Script
 *
 * Instagram uses hard blocks handled by background script.
 * This handles SPA navigation detection.
 */

import { PlatformContentScript } from '../base.js';

class InstagramContentScript extends PlatformContentScript {
  constructor() {
    super('instagram');
  }

  protected applySoftBlocks(): void {
    // Instagram uses hard blocks only
  }

  protected setupObserver(): void {
    // No soft blocks to observe
  }
}

const script = new InstagramContentScript();
script.init().catch(console.error);
