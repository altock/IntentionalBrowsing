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

async function sendMessage<T>(message: ExtensionMessage): Promise<ExtensionResponse<T>> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response: ExtensionResponse<T>) => {
      resolve(response || { success: false, error: 'No response' });
    });
  });
}

async function loadConfig(): Promise<StorageSchema | null> {
  const response = await sendMessage<StorageSchema>({ type: 'GET_CONFIG' });
  if (response.success && response.data) {
    currentConfig = response.data;
    return response.data;
  }
  return null;
}

async function saveConfig(config: StorageSchema): Promise<void> {
  await sendMessage({ type: 'SET_CONFIG', payload: config });
  currentConfig = config;
}

function render(config: StorageSchema): void {
  const popup = document.querySelector('.popup')!;
  const globalToggle = document.getElementById('global-enabled') as HTMLInputElement;
  const platformsContainer = document.getElementById('platforms')!;
  const statsContainer = document.getElementById('stats')!;

  globalToggle.checked = config.globalEnabled;
  popup.classList.toggle('disabled', !config.globalEnabled);

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

  statsContainer.textContent = `Blocked ${config.stats.blocksTotal} distractions`;
}

async function handleGlobalToggle(enabled: boolean): Promise<void> {
  if (!currentConfig) return;
  currentConfig.globalEnabled = enabled;
  await saveConfig(currentConfig);
  render(currentConfig);
}

async function handlePlatformToggle(platformId: PlatformId, enabled: boolean): Promise<void> {
  if (!currentConfig) return;
  currentConfig.platforms[platformId].enabled = enabled;
  await saveConfig(currentConfig);
  render(currentConfig);
}

function setupEventListeners(): void {
  document.getElementById('global-enabled')?.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    handleGlobalToggle(target.checked);
  });

  document.getElementById('platforms')?.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    if (target.dataset.platform) {
      handlePlatformToggle(target.dataset.platform as PlatformId, target.checked);
    }
  });
}

async function init(): Promise<void> {
  setupEventListeners();
  const config = await loadConfig();
  if (config) {
    render(config);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
