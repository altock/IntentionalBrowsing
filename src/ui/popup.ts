/**
 * Popup UI Script
 */

import type { ExtensionMessage, ExtensionResponse, PlatformId, StorageSchema } from '../shared/types.js';
import { PLATFORM_REDIRECT_OPTIONS } from '../shared/config.js';

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
const expandedPlatforms = new Set<PlatformId>();

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

  globalToggle.checked = config.globalEnabled;
  popup.classList.toggle('disabled', !config.globalEnabled);

  platformsContainer.innerHTML = PLATFORM_ORDER.map((platformId) => {
    const platformConfig = config.platforms[platformId];
    const redirectOptions = PLATFORM_REDIRECT_OPTIONS[platformId];
    const hasSettings = redirectOptions.length > 1;
    const isExpanded = expandedPlatforms.has(platformId);

    const settingsHtml = hasSettings ? `
      <div class="platform-settings ${isExpanded ? 'expanded' : ''}">
        <label class="setting-row">
          <span class="setting-label">Redirect to:</span>
          <select class="redirect-select" data-platform="${platformId}">
            ${redirectOptions.map(opt =>
              `<option value="${opt.value}" ${platformConfig.redirectTarget === opt.value ? 'selected' : ''}>${opt.label}</option>`
            ).join('')}
          </select>
        </label>
      </div>
    ` : '';

    return `
      <div class="platform ${isExpanded ? 'expanded' : ''}" data-platform="${platformId}">
        <div class="platform-row">
          <div class="platform-info">
            <span class="platform-name">${PLATFORM_NAMES[platformId]}</span>
          </div>
          <div class="platform-controls">
            ${hasSettings ? `
              <button class="btn-settings" data-platform="${platformId}" title="Settings">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"></path>
                </svg>
              </button>
            ` : ''}
            <label class="platform-toggle">
              <input type="checkbox" data-platform="${platformId}" ${platformConfig.enabled ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
        ${settingsHtml}
      </div>
    `;
  }).join('');
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

async function handleRedirectChange(platformId: PlatformId, redirectTarget: string): Promise<void> {
  if (!currentConfig) return;
  currentConfig.platforms[platformId].redirectTarget = redirectTarget;
  await saveConfig(currentConfig);
}

function toggleSettings(platformId: PlatformId): void {
  if (expandedPlatforms.has(platformId)) {
    expandedPlatforms.delete(platformId);
  } else {
    expandedPlatforms.add(platformId);
  }
  if (currentConfig) {
    render(currentConfig);
  }
}

function setupEventListeners(): void {
  document.getElementById('global-enabled')?.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    handleGlobalToggle(target.checked);
  });

  document.getElementById('platforms')?.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement | HTMLSelectElement;
    if (target.dataset.platform) {
      if (target.tagName === 'INPUT' && target.type === 'checkbox') {
        handlePlatformToggle(target.dataset.platform as PlatformId, (target as HTMLInputElement).checked);
      } else if (target.tagName === 'SELECT') {
        handleRedirectChange(target.dataset.platform as PlatformId, target.value);
      }
    }
  });

  document.getElementById('platforms')?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const settingsBtn = target.closest('.btn-settings') as HTMLElement;
    if (settingsBtn?.dataset.platform) {
      toggleSettings(settingsBtn.dataset.platform as PlatformId);
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
