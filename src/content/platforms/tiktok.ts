/**
 * TikTok Content Script
 *
 * TikTok is blocked entirely by default (nuclear option).
 * This script handles SPA navigation in case the user enables profiles/DMs.
 */

import { PlatformContentScript, sendMessage } from '../base.js';
import type { StorageSchema } from '../../shared/types.js';

class TikTokContentScript extends PlatformContentScript {
  constructor() {
    super('tiktok');
  }

  async init(): Promise<void> {
    // Load config
    const response = await sendMessage<StorageSchema>({ type: 'GET_CONFIG' });
    const config = response.data;

    // TikTok defaults to blocking everything
    // Only init if there's something to do
    if (config?.platforms.tiktok.enabled) {
      await super.init();
    }
  }

  protected applySoftBlocks(): void {
    // TikTok is hard blocked by default
    // No soft blocks implemented
  }

  protected setupObserver(): void {
    // No soft blocks to observe
  }
}

// Initialize
const script = new TikTokContentScript();
script.init().catch(console.error);
