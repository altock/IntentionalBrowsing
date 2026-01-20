/**
 * Popup UI Script
 */

import type { ExtensionMessage, ExtensionResponse, PlatformId, StorageSchema } from '../shared/types.js';

const PLATFORM_NAMES: Record<PlatformId, string> = {
  twitter: 'X / Twitter',
  reddit: 'Reddit',
  youtube: 'YouTube',
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
};

const PLATFORM_ORDER: PlatformId[] = [
  'twitter',
  'reddit',
  'youtube',
  'instagram',
  'facebook',
  'linkedin',
  'tiktok',
];

let currentConfig: StorageSchema | null = null;
let pauseTimerInterval: number | null = null;

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
 * Load config from background
 */
async function loadConfig(): Promise<StorageSchema | null> {
  const response = await sendMessage<StorageSchema>({ type: 'GET_CONFIG' });
  if (response.success && response.data) {
    currentConfig = response.data;
    return response.data;
  }
  return null;
}

/**
 * Save config to background
 */
async function saveConfig(config: StorageSchema): Promise<void> {
  await sendMessage({ type: 'SET_CONFIG', payload: config });
  currentConfig = config;
}

/**
 * Render the popup
 */
function render(config: StorageSchema): void {
  const popup = document.querySelector('.popup')!;
  const globalToggle = document.getElementById('global-enabled') as HTMLInputElement;
  const platformsContainer = document.getElementById('platforms')!;
  const statsContainer = document.getElementById('stats')!;

  // Update global state
  globalToggle.checked = config.globalEnabled;
  popup.classList.toggle('disabled', !config.globalEnabled);

  // Check pause state
  const isPaused = config.pause.globalUntil && config.pause.globalUntil > Date.now();
  popup.classList.toggle('paused', !!isPaused);

  // Render platforms
  platformsContainer.innerHTML = PLATFORM_ORDER.map((platformId) => {
    const platformConfig = config.platforms[platformId];
    return `
      <div class="platform" data-platform="${platformId}">
        <div class="platform-info">
          <span class="platform-name">${PLATFORM_NAMES[platformId]}</span>
        </div>
        <div class="platform-controls">
          <label class="platform-toggle">
            <input type="checkbox" data-platform="${platformId}" ${platformConfig.enabled ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
    `;
  }).join('');

  // Render stats
  statsContainer.innerHTML = `Blocked ${config.stats.blocksTotal} distractions`;

  // Render pause timer if active
  renderPauseTimer(config);
}

/**
 * Render pause timer
 */
function renderPauseTimer(config: StorageSchema): void {
  const footer = document.querySelector('.footer')!;
  let timerEl = footer.querySelector('.pause-timer');

  if (config.pause.globalUntil && config.pause.globalUntil > Date.now()) {
    const remaining = config.pause.globalUntil - Date.now();
    const minutes = Math.ceil(remaining / 60000);

    if (!timerEl) {
      timerEl = document.createElement('div');
      timerEl.className = 'pause-timer';
      footer.insertBefore(timerEl, footer.querySelector('.stats'));
    }

    timerEl.innerHTML = `
      Paused for ${minutes} minute${minutes !== 1 ? 's' : ''}
      <button id="resume-btn">Resume</button>
    `;

    // Set up timer update
    if (pauseTimerInterval) {
      clearInterval(pauseTimerInterval);
    }
    pauseTimerInterval = window.setInterval(() => {
      if (currentConfig) {
        renderPauseTimer(currentConfig);
      }
    }, 10000);
  } else {
    if (timerEl) {
      timerEl.remove();
    }
    if (pauseTimerInterval) {
      clearInterval(pauseTimerInterval);
      pauseTimerInterval = null;
    }
  }
}

/**
 * Handle global toggle change
 */
async function handleGlobalToggle(enabled: boolean): Promise<void> {
  if (!currentConfig) return;

  currentConfig.globalEnabled = enabled;
  await saveConfig(currentConfig);
  render(currentConfig);
}

/**
 * Handle platform toggle change
 */
async function handlePlatformToggle(platformId: PlatformId, enabled: boolean): Promise<void> {
  if (!currentConfig) return;

  currentConfig.platforms[platformId].enabled = enabled;
  await saveConfig(currentConfig);
  render(currentConfig);
}

/**
 * Handle pause button click
 */
async function handlePause(duration: number): Promise<void> {
  await sendMessage({ type: 'PAUSE', payload: { duration } });
  const config = await loadConfig();
  if (config) {
    render(config);
  }
}

/**
 * Handle resume button click
 */
async function handleResume(): Promise<void> {
  await sendMessage({ type: 'RESUME', payload: {} });
  const config = await loadConfig();
  if (config) {
    render(config);
  }
}

/**
 * Set up event listeners
 */
function setupEventListeners(): void {
  // Global toggle
  document.getElementById('global-enabled')?.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    handleGlobalToggle(target.checked);
  });

  // Platform toggles
  document.getElementById('platforms')?.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    if (target.dataset.platform) {
      handlePlatformToggle(target.dataset.platform as PlatformId, target.checked);
    }
  });

  // Pause buttons
  document.querySelectorAll('.btn-pause').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const target = e.target as HTMLButtonElement;
      const duration = parseInt(target.dataset.duration || '0', 10);
      if (duration > 0) {
        handlePause(duration);
      }
    });
  });

  // Resume button (delegated)
  document.querySelector('.footer')?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.id === 'resume-btn') {
      handleResume();
    }
  });
}

/**
 * Initialize popup
 */
async function init(): Promise<void> {
  setupEventListeners();

  const config = await loadConfig();
  if (config) {
    render(config);
  } else {
    console.error('[IntentionalBrowsing] Failed to load config');
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
