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

const PLATFORM_ICONS: Record<PlatformId, string> = {
  twitter: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
  reddit: `<svg width="16" height="16" viewBox="0 0 24 24" fill="#FF4500"><circle cx="12" cy="12" r="10"/><path fill="white" d="M16.5 13.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5 1.5.67 1.5 1.5zm-7.5 0c0 .83-.67 1.5-1.5 1.5S6 14.33 6 13.5 6.67 12 7.5 12s1.5.67 1.5 1.5zm3 4.5c-1.93 0-3.5-.9-3.5-2h7c0 1.1-1.57 2-3.5 2z"/></svg>`,
  youtube: `<svg width="16" height="16" viewBox="0 0 24 24" fill="#FF0000"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
  instagram: `<svg width="16" height="16" viewBox="0 0 24 24" fill="url(#ig-gradient)"><defs><linearGradient id="ig-gradient" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" style="stop-color:#FFDC80"/><stop offset="25%" style="stop-color:#F77737"/><stop offset="50%" style="stop-color:#E1306C"/><stop offset="75%" style="stop-color:#C13584"/><stop offset="100%" style="stop-color:#5851DB"/></linearGradient></defs><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>`,
  facebook: `<svg width="16" height="16" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`,
  linkedin: `<svg width="16" height="16" viewBox="0 0 24 24" fill="#0A66C2"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`,
  tiktok: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>`,
};

const PLATFORM_ORDER: PlatformId[] = [
  'twitter',
  'reddit',
  'youtube',
  'instagram',
  'facebook',
  // 'linkedin', // Disabled - selectors need updating (#1)
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

function createElementFromHTML(html: string): Element {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html.trim(), 'image/svg+xml');
  return doc.documentElement;
}

function render(config: StorageSchema): void {
  const popup = document.querySelector('.popup')!;
  const globalToggle = document.getElementById('global-enabled') as HTMLInputElement;
  const platformsContainer = document.getElementById('platforms')!;

  globalToggle.checked = config.globalEnabled;
  popup.classList.toggle('disabled', !config.globalEnabled);

  // Clear existing content
  platformsContainer.textContent = '';

  PLATFORM_ORDER.forEach((platformId) => {
    const platformConfig = config.platforms[platformId];
    const redirectOptions = PLATFORM_REDIRECT_OPTIONS[platformId];
    const hasSettings = redirectOptions.length > 1;

    // Create platform container
    const platformDiv = document.createElement('div');
    platformDiv.className = 'platform';
    platformDiv.dataset.platform = platformId;

    // Create platform row
    const platformRow = document.createElement('div');
    platformRow.className = 'platform-row';

    // Create platform info
    const platformInfo = document.createElement('div');
    platformInfo.className = 'platform-info';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'platform-icon';
    iconSpan.appendChild(createElementFromHTML(PLATFORM_ICONS[platformId]));

    const nameSpan = document.createElement('span');
    nameSpan.className = 'platform-name';
    nameSpan.textContent = PLATFORM_NAMES[platformId];

    platformInfo.appendChild(iconSpan);
    platformInfo.appendChild(nameSpan);

    // Create platform controls
    const platformControls = document.createElement('div');
    platformControls.className = 'platform-controls';

    const toggleLabel = document.createElement('label');
    toggleLabel.className = 'platform-toggle';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.platform = platformId;
    checkbox.checked = platformConfig.enabled;

    const slider = document.createElement('span');
    slider.className = 'toggle-slider';

    toggleLabel.appendChild(checkbox);
    toggleLabel.appendChild(slider);
    platformControls.appendChild(toggleLabel);

    platformRow.appendChild(platformInfo);
    platformRow.appendChild(platformControls);
    platformDiv.appendChild(platformRow);

    // Add settings if needed
    if (hasSettings) {
      const settingsDiv = document.createElement('div');
      settingsDiv.className = 'platform-settings expanded';

      const settingLabel = document.createElement('label');
      settingLabel.className = 'setting-row';

      const labelSpan = document.createElement('span');
      labelSpan.className = 'setting-label';
      labelSpan.textContent = 'Redirect to:';

      const select = document.createElement('select');
      select.className = 'redirect-select';
      select.dataset.platform = platformId;

      redirectOptions.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        option.selected = platformConfig.redirectTarget === opt.value;
        select.appendChild(option);
      });

      settingLabel.appendChild(labelSpan);
      settingLabel.appendChild(select);
      settingsDiv.appendChild(settingLabel);
      platformDiv.appendChild(settingsDiv);
    }

    platformsContainer.appendChild(platformDiv);
  });
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
