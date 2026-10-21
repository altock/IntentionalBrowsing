import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyConfigUpdate } from '../../src/shared/config-updates.js';
import { DEFAULT_STORAGE } from '../../src/shared/config.js';
import type { ExtensionMessage, ExtensionResponse, StorageSchema } from '../../src/shared/types.js';

function cloneConfig(config: StorageSchema): StorageSchema {
  return JSON.parse(JSON.stringify(config));
}

async function mountPopup(
  handleMessage: (message: ExtensionMessage) => ExtensionResponse<StorageSchema>
): Promise<ReturnType<typeof vi.fn>> {
  document.body.innerHTML = `
    <div class="popup">
      <label class="global-toggle">
        <input type="checkbox" id="global-enabled" checked>
        <span class="toggle-slider"></span>
      </label>
      <main id="platforms"></main>
    </div>
  `;

  const sendMessage = vi.fn((message: ExtensionMessage, callback: (response: ExtensionResponse<StorageSchema>) => void) => {
    queueMicrotask(() => callback(handleMessage(message)));
  });
  vi.stubGlobal('chrome', { runtime: { sendMessage } });

  vi.resetModules();
  await import('../../src/ui/popup.js');
  await vi.waitFor(() => {
    expect(document.querySelectorAll('.platform')).toHaveLength(6);
  });

  return sendMessage;
}

describe('popup config updates', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('sends a granular update instead of a stale whole-config snapshot', async () => {
    const stored = cloneConfig(DEFAULT_STORAGE);
    const sendMessage = await mountPopup((message) => {
      if (message.type === 'GET_CONFIG') {
        return { success: true, data: cloneConfig(stored) };
      }
      return { success: true, data: cloneConfig(stored) };
    });

    const toggle = document.getElementById('global-enabled') as HTMLInputElement;
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));

    await vi.waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith(
        {
          type: 'UPDATE_CONFIG',
          payload: { kind: 'global-enabled', enabled: false },
        },
        expect.any(Function)
      );
    });
  });

  it('restores stored state when a save fails', async () => {
    const stored = cloneConfig(DEFAULT_STORAGE);
    await mountPopup((message) => {
      if (message.type === 'GET_CONFIG') {
        return { success: true, data: cloneConfig(stored) };
      }
      return { success: false, error: 'Storage unavailable' };
    });

    const toggle = document.getElementById('global-enabled') as HTMLInputElement;
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));

    await vi.waitFor(() => {
      expect((document.getElementById('global-enabled') as HTMLInputElement).checked).toBe(true);
    });
  });
  it('saves an alternative page and rejects a destination that is itself blocked', async () => {
    let stored = cloneConfig(DEFAULT_STORAGE);
    const sendMessage = await mountPopup((message) => {
      if (message.type === 'UPDATE_CONFIG') stored = applyConfigUpdate(stored, message.payload as any);
      return { success: true, data: cloneConfig(stored) };
    });
    const select = document.querySelector('.platform[data-platform="reddit"] select') as HTMLSelectElement;
    select.value = 'custom';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect(document.querySelector('.platform[data-platform="reddit"] form')).not.toBeNull());
    await vi.waitFor(() => expect(stored.platforms.reddit.redirectTarget).toBe('custom'));
    const form = () => document.querySelector('.platform[data-platform="reddit"] form') as HTMLFormElement;
    const input = () => form().querySelector('input')!;
    input().value = 'https://example.com/read';
    form().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(stored.platforms.reddit.customSettings?.alternativeUrl).toBe('https://example.com/read'));
    await vi.waitFor(() => expect(input().value).toBe('https://example.com/read'));
    input().value = 'https://x.com/home';
    form().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(input().validationMessage).toContain('not a blocked feed');
    expect(stored.platforms.reddit.customSettings?.alternativeUrl).toBe('https://example.com/read');
    expect(sendMessage).toHaveBeenCalled();
  });

  it('keeps an in-progress address when the redirect selection finishes saving', async () => {
    const stored = cloneConfig(DEFAULT_STORAGE);
    const sendMessage = await mountPopup(() => ({ success: true, data: cloneConfig(stored) }));
    let finishSave: () => void = () => {};
    sendMessage.mockImplementationOnce((message: ExtensionMessage, callback: (response: ExtensionResponse<StorageSchema>) => void) => {
      const saved = applyConfigUpdate(stored, message.payload as any);
      finishSave = () => callback({ success: true, data: saved });
    });
    const select = document.querySelector('.platform[data-platform="reddit"] select') as HTMLSelectElement;
    select.value = 'custom';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    const input = document.querySelector('.platform[data-platform="reddit"] input[type="url"]') as HTMLInputElement;
    input.value = 'https://example.com/in-progress';
    finishSave();
    await Promise.resolve();
    expect(document.querySelector('.platform[data-platform="reddit"] input[type="url"]')).toBe(input);
    expect(input.value).toBe('https://example.com/in-progress');
  });

});
