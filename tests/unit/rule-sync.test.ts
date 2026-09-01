import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_STORAGE } from '../../src/shared/config.js';
import { createQueuedConfigSync } from '../../src/shared/rule-sync.js';

describe('createQueuedConfigSync', () => {
  it('retries a configuration after its previous apply attempt failed', async () => {
    const loadConfig = vi.fn().mockResolvedValue(DEFAULT_STORAGE);
    const applyConfig = vi
      .fn()
      .mockRejectedValueOnce(new Error('declarativeNetRequest unavailable'))
      .mockResolvedValueOnce(undefined);
    const sync = createQueuedConfigSync(loadConfig, () => 'current-config', applyConfig);

    await expect(sync()).rejects.toThrow('declarativeNetRequest unavailable');
    await expect(sync()).resolves.toBeUndefined();

    expect(applyConfig).toHaveBeenCalledTimes(2);
  });
});
