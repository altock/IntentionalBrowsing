/**
 * Blocked Page Script
 */

import { getPlatformFromUrl } from '../shared/rules.js';

/**
 * Initialize the page
 */
function init(): void {
  const params = new URLSearchParams(window.location.search);
  const blockedUrl = params.get('url');

  if (blockedUrl) {
    const platformId = getPlatformFromUrl(blockedUrl);
    const subtitle = document.getElementById('subtitle');
    if (subtitle && platformId) {
      subtitle.textContent = `You tried to access ${platformId}.`;
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
