/**
 * TikTok Content Script
 *
 * TikTok is blocked entirely by default (nuclear option).
 * This handles SPA navigation detection.
 */

import { PlatformContentScript } from '../base.js';

class TikTokContentScript extends PlatformContentScript {
  constructor() {
    super('tiktok');
  }

  protected applySoftBlocks(): void {
    // TikTok is hard blocked entirely
  }

  protected setupObserver(): void {
    // No soft blocks to observe
  }
}

const script = new TikTokContentScript();
script.init().catch(console.error);
