import { afterEach, expect, it, vi } from 'vitest';
import { DEFAULT_STORAGE } from '../../src/shared/config.js';
import type { ExtensionMessage, ExtensionResponse } from '../../src/shared/types.js';

afterEach(() => vi.unstubAllGlobals());

it('reloads only after settings synchronization succeeds, and ignores superseded acknowledgements', async () => {
  vi.resetModules();
  const reload = vi.fn();
  vi.stubGlobal('window', { location: { reload } });
  let onChange: (changes: object, area: string) => void = () => {};
  const acknowledgements: ((response: ExtensionResponse) => void)[] = [];
  vi.stubGlobal('chrome', {
    runtime: { sendMessage: (message: ExtensionMessage, callback: (response: ExtensionResponse) => void) => {
      expect(message.type).toBe('SYNC_CONFIG');
      acknowledgements.push(callback);
    } },
    storage: { onChanged: { addListener: (listener: typeof onChange) => { onChange = listener; }, removeListener: vi.fn() } },
  });
  const { PlatformContentScript } = await import('../../src/content/base.js');
  class TestContent extends PlatformContentScript {
    constructor() { super('youtube'); }
    protected applySoftBlocks() {}
    protected setupObserver() {}
  }
  new TestContent();
  const oldValue = structuredClone(DEFAULT_STORAGE);
  const newValue = structuredClone(DEFAULT_STORAGE);
  newValue.platforms.youtube.redirectTarget = 'blocked';
  onChange({ config: { oldValue, newValue } }, 'local');
  expect(reload).not.toHaveBeenCalled();
  onChange({ config: { oldValue: newValue, newValue: oldValue } }, 'local');
  acknowledgements[0]({ success: true });
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(reload).not.toHaveBeenCalled();
  acknowledgements[1]({ success: true });
  await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  onChange({ config: { oldValue, newValue } }, 'local');
  acknowledgements[2]({ success: false, error: 'Rule update failed' });
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(reload).toHaveBeenCalledTimes(1);
});
