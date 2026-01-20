/**
 * Reddit Content Script
 *
 * Reddit mostly uses hard blocks, but this handles SPA navigation
 */

import { PlatformContentScript, sendMessage } from '../base.js';
import type { StorageSchema } from '../../shared/types.js';

class RedditContentScript extends PlatformContentScript {
  constructor() {
    super('reddit');
  }

  protected applySoftBlocks(): void {
    // Reddit primarily uses hard blocks
    // Could add soft blocks for sidebar recommendations in the future
  }

  protected setupObserver(): void {
    // No soft blocks to observe for Reddit currently
  }
}

// Initialize
const script = new RedditContentScript();
script.init().catch(console.error);
