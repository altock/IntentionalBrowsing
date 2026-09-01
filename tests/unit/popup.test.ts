import { beforeEach, describe, expect, it, vi } from 'vitest';
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
});
