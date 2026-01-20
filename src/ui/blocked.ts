/**
 * Blocked Page Script
 */

import type { ExtensionMessage, ExtensionResponse, StorageSchema } from '../shared/types.js';
import { getPlatformFromUrl } from '../shared/rules.js';

const SAFE_PAGES: Record<string, string> = {
  twitter: 'https://twitter.com/messages',
  reddit: 'https://reddit.com/r/all', // Ironic but forces intentionality
  youtube: 'https://youtube.com/feed/subscriptions',
  instagram: 'https://instagram.com/direct/inbox/',
  facebook: 'https://facebook.com/messages/',
  linkedin: 'https://linkedin.com/messaging/',
  tiktok: '', // No safe page for TikTok
};

let blockedUrl: string | null = null;
let platformId: string | null = null;

/**
 * Send message to background script
 */
async function sendMessage<T>(message: ExtensionMessage): Promise<ExtensionResponse<T>> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response: ExtensionResponse<T>) => {
      resolve(response || { success: false, error: 'No response' });
    });
  });
}

/**
 * Get blocked URL from query params
 */
function getBlockedUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('url');
}

/**
 * Initialize the page
 */
async function init(): Promise<void> {
  blockedUrl = getBlockedUrl();

  if (blockedUrl) {
    platformId = getPlatformFromUrl(blockedUrl);
  }

  // Update subtitle
  const subtitle = document.getElementById('subtitle');
  if (subtitle && platformId) {
    subtitle.textContent = `You tried to access ${platformId}.`;
  }

  // Update safe page link
  const safeLink = document.getElementById('go-safe') as HTMLAnchorElement;
  if (safeLink && platformId && SAFE_PAGES[platformId]) {
    safeLink.href = SAFE_PAGES[platformId];
    safeLink.textContent = 'Go to safe page';
  } else if (safeLink) {
    safeLink.style.display = 'none';
  }

  // Check pause state
  await checkPauseState();

  // Set up event listeners
  setupEventListeners();
}

/**
 * Check if blocking is paused
 */
async function checkPauseState(): Promise<void> {
  const response = await sendMessage<StorageSchema>({ type: 'GET_CONFIG' });
  const config = response.data;

  const pauseSection = document.getElementById('pause-section');
  const pauseActive = document.getElementById('pause-active');
  const pauseUntil = document.getElementById('pause-until');

  if (!config || !pauseSection || !pauseActive || !pauseUntil) return;

  const isPaused = config.pause.globalUntil && config.pause.globalUntil > Date.now();

  if (isPaused && config.pause.globalUntil) {
    pauseSection.style.display = 'none';
    pauseActive.style.display = 'block';

    const date = new Date(config.pause.globalUntil);
    pauseUntil.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // If paused, redirect to the original URL
    if (blockedUrl) {
      window.location.href = blockedUrl;
    }
  } else {
    pauseSection.style.display = 'block';
    pauseActive.style.display = 'none';
  }
}

/**
 * Set up event listeners
 */
function setupEventListeners(): void {
  // Go back button
  document.getElementById('go-back')?.addEventListener('click', () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.close();
    }
  });

  // Pause buttons
  document.querySelectorAll('[data-duration]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const target = e.target as HTMLButtonElement;
      const duration = parseInt(target.dataset.duration || '0', 10);

      if (duration > 0) {
        await sendMessage({ type: 'PAUSE', payload: { duration } });

        // Redirect to original URL
        if (blockedUrl) {
          window.location.href = blockedUrl;
        }
      }
    });
  });

  // Resume button
  document.getElementById('resume-btn')?.addEventListener('click', async () => {
    await sendMessage({ type: 'RESUME', payload: {} });
    await checkPauseState();
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
