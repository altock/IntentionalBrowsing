import { describe, expect, it } from 'vitest';
import { DEFAULT_STORAGE } from '../../src/shared/config.js';
import { applyConfigUpdate } from '../../src/shared/config-updates.js';

describe('applyConfigUpdate', () => {
  it('applies one setting without mutating the source config', () => {
    const updated = applyConfigUpdate(DEFAULT_STORAGE, {
      kind: 'platform-enabled',
      platformId: 'youtube',
      enabled: false,
    });

    expect(updated.platforms.youtube.enabled).toBe(false);
    expect(updated.platforms.twitter.enabled).toBe(true);
    expect(DEFAULT_STORAGE.platforms.youtube.enabled).toBe(true);
  });

  it('merges custom settings without removing existing values', () => {
    const updated = applyConfigUpdate(DEFAULT_STORAGE, {
      kind: 'platform-custom-settings',
      platformId: 'youtube',
      customSettings: { disableAutoplay: false },
    });

    expect(updated.platforms.youtube.customSettings).toEqual({
      disableAutoplay: false,
      shortsRedirectToWatch: true,
    });
  });
});
