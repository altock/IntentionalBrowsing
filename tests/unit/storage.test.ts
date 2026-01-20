import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Storage, migrateSchema } from '../../src/shared/storage.js';
import { DEFAULT_STORAGE, SCHEMA_VERSION } from '../../src/shared/config.js';
import type { StorageSchema } from '../../src/shared/types.js';

// Mock chrome.storage API
const mockStorage: Record<string, unknown> = {};

const mockChromeStorage = {
  local: {
    get: vi.fn((keys: string | string[] | null) => {
      return Promise.resolve(
        keys === null
          ? { ...mockStorage }
          : typeof keys === 'string'
            ? { [keys]: mockStorage[keys] }
            : keys.reduce((acc, key) => ({ ...acc, [key]: mockStorage[key] }), {})
      );
    }),
    set: vi.fn((items: Record<string, unknown>) => {
      Object.assign(mockStorage, items);
      return Promise.resolve();
    }),
    remove: vi.fn((keys: string | string[]) => {
      const keysArray = typeof keys === 'string' ? [keys] : keys;
      keysArray.forEach(key => delete mockStorage[key]);
      return Promise.resolve();
    }),
    clear: vi.fn(() => {
      Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
      return Promise.resolve();
    }),
  },
};

// Set up global chrome mock
vi.stubGlobal('chrome', { storage: mockChromeStorage });

describe('Storage', () => {
  beforeEach(() => {
    // Clear mock storage before each test
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
    vi.clearAllMocks();
  });

  describe('load', () => {
    it('should return default config when storage is empty', async () => {
      const config = await Storage.load();

      expect(config.schemaVersion).toBe(SCHEMA_VERSION);
      expect(config.globalEnabled).toBe(true);
      expect(config.platforms.twitter.enabled).toBe(true);
      expect(config.platforms.facebook.enabled).toBe(false);
    });

    it('should return stored config when present', async () => {
      const customConfig: StorageSchema = {
        ...DEFAULT_STORAGE,
        globalEnabled: false,
        platforms: {
          ...DEFAULT_STORAGE.platforms,
          twitter: {
            ...DEFAULT_STORAGE.platforms.twitter,
            enabled: false,
          },
        },
      };
      mockStorage['config'] = customConfig;

      const config = await Storage.load();

      expect(config.globalEnabled).toBe(false);
      expect(config.platforms.twitter.enabled).toBe(false);
    });

    it('should migrate old schema versions', async () => {
      // Simulate old schema (version 0, no version field)
      const oldConfig = {
        global_enabled: true,
        platforms: {
          twitter: {
            enabled: true,
            block_home: true,
          },
        },
      };
      mockStorage['config'] = oldConfig;

      const config = await Storage.load();

      // Should be migrated to current version
      expect(config.schemaVersion).toBe(SCHEMA_VERSION);
      expect(config.globalEnabled).toBe(true);
    });
  });

  describe('save', () => {
    it('should save config to storage', async () => {
      const config: StorageSchema = {
        ...DEFAULT_STORAGE,
        globalEnabled: false,
      };

      await Storage.save(config);

      expect(mockChromeStorage.local.set).toHaveBeenCalledWith({ config });
      expect(mockStorage['config']).toEqual(config);
    });
  });

  describe('updatePlatform', () => {
    it('should update a specific platform config', async () => {
      mockStorage['config'] = { ...DEFAULT_STORAGE };

      await Storage.updatePlatform('twitter', { enabled: false });

      const saved = mockStorage['config'] as StorageSchema;
      expect(saved.platforms.twitter.enabled).toBe(false);
      // Other platforms should be unchanged
      expect(saved.platforms.reddit.enabled).toBe(true);
    });

    it('should merge partial updates', async () => {
      mockStorage['config'] = { ...DEFAULT_STORAGE };

      await Storage.updatePlatform('twitter', {
        hardBlocks: { home: false },
      });

      const saved = mockStorage['config'] as StorageSchema;
      expect(saved.platforms.twitter.hardBlocks.home).toBe(false);
      // Other hard blocks should be preserved
      expect(saved.platforms.twitter.hardBlocks.explore).toBe(true);
    });
  });

  describe('toggleGlobal', () => {
    it('should toggle global enabled state', async () => {
      mockStorage['config'] = { ...DEFAULT_STORAGE, globalEnabled: true };

      await Storage.toggleGlobal(false);

      const saved = mockStorage['config'] as StorageSchema;
      expect(saved.globalEnabled).toBe(false);
    });
  });

  describe('pause', () => {
    it('should set global pause timestamp', async () => {
      mockStorage['config'] = { ...DEFAULT_STORAGE };
      const pauseUntil = Date.now() + 5 * 60 * 1000; // 5 minutes

      await Storage.setPause(pauseUntil);

      const saved = mockStorage['config'] as StorageSchema;
      expect(saved.pause.globalUntil).toBe(pauseUntil);
    });

    it('should set platform-specific pause', async () => {
      mockStorage['config'] = { ...DEFAULT_STORAGE };
      const pauseUntil = Date.now() + 5 * 60 * 1000;

      await Storage.setPause(pauseUntil, 'twitter');

      const saved = mockStorage['config'] as StorageSchema;
      expect(saved.pause.platforms.twitter).toBe(pauseUntil);
      expect(saved.pause.globalUntil).toBeNull();
    });

    it('should clear pause when time has passed', async () => {
      const expiredPause = Date.now() - 1000; // 1 second ago
      mockStorage['config'] = {
        ...DEFAULT_STORAGE,
        pause: {
          globalUntil: expiredPause,
          platforms: {},
        },
      };

      const config = await Storage.load();

      // Expired pauses should be cleared on load
      expect(config.pause.globalUntil).toBeNull();
    });
  });

  describe('isPaused', () => {
    it('should return true when globally paused', async () => {
      const pauseUntil = Date.now() + 5 * 60 * 1000;
      mockStorage['config'] = {
        ...DEFAULT_STORAGE,
        pause: { globalUntil: pauseUntil, platforms: {} },
      };

      const config = await Storage.load();
      const isPaused = Storage.isPaused(config);

      expect(isPaused).toBe(true);
    });

    it('should return false when pause expired', async () => {
      const expiredPause = Date.now() - 1000;
      mockStorage['config'] = {
        ...DEFAULT_STORAGE,
        pause: { globalUntil: expiredPause, platforms: {} },
      };

      const config = await Storage.load();
      const isPaused = Storage.isPaused(config);

      expect(isPaused).toBe(false);
    });

    it('should return true when specific platform is paused', async () => {
      const pauseUntil = Date.now() + 5 * 60 * 1000;
      mockStorage['config'] = {
        ...DEFAULT_STORAGE,
        pause: { globalUntil: null, platforms: { twitter: pauseUntil } },
      };

      const config = await Storage.load();
      const isPausedTwitter = Storage.isPaused(config, 'twitter');
      const isPausedReddit = Storage.isPaused(config, 'reddit');

      expect(isPausedTwitter).toBe(true);
      expect(isPausedReddit).toBe(false);
    });
  });

  describe('incrementBlockCount', () => {
    it('should increment total block count', async () => {
      mockStorage['config'] = {
        ...DEFAULT_STORAGE,
        stats: { blocksTotal: 5, lastBlock: null },
      };

      await Storage.incrementBlockCount();

      const saved = mockStorage['config'] as StorageSchema;
      expect(saved.stats.blocksTotal).toBe(6);
      expect(saved.stats.lastBlock).toBeGreaterThan(0);
    });
  });

  describe('reset', () => {
    it('should reset to default config', async () => {
      mockStorage['config'] = {
        ...DEFAULT_STORAGE,
        globalEnabled: false,
        platforms: {
          ...DEFAULT_STORAGE.platforms,
          twitter: { ...DEFAULT_STORAGE.platforms.twitter, enabled: false },
        },
      };

      await Storage.reset();

      const saved = mockStorage['config'] as StorageSchema;
      expect(saved).toEqual(DEFAULT_STORAGE);
    });
  });
});

describe('migrateSchema', () => {
  it('should return default for null/undefined', () => {
    expect(migrateSchema(null)).toEqual(DEFAULT_STORAGE);
    expect(migrateSchema(undefined)).toEqual(DEFAULT_STORAGE);
  });

  it('should return default for non-object', () => {
    expect(migrateSchema('string')).toEqual(DEFAULT_STORAGE);
    expect(migrateSchema(123)).toEqual(DEFAULT_STORAGE);
  });

  it('should migrate schema version 0 (no version) to current', () => {
    const oldSchema = {
      global_enabled: false,
      platforms: {
        twitter: {
          enabled: true,
          block_home: true,
          block_explore: false,
        },
      },
    };

    const migrated = migrateSchema(oldSchema);

    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
    expect(migrated.globalEnabled).toBe(false);
    // Should preserve old values where possible and fill in defaults
    expect(migrated.platforms.twitter.enabled).toBe(true);
  });

  it('should preserve current schema without changes', () => {
    const currentSchema: StorageSchema = {
      ...DEFAULT_STORAGE,
      globalEnabled: false,
    };

    const migrated = migrateSchema(currentSchema);

    expect(migrated).toEqual(currentSchema);
  });

  it('should fill in missing platforms with defaults', () => {
    const partialSchema = {
      schemaVersion: SCHEMA_VERSION,
      globalEnabled: true,
      platforms: {
        twitter: DEFAULT_STORAGE.platforms.twitter,
        // Missing other platforms
      },
      pause: DEFAULT_STORAGE.pause,
      stats: DEFAULT_STORAGE.stats,
    };

    const migrated = migrateSchema(partialSchema);

    // Should have all platforms
    expect(migrated.platforms.reddit).toBeDefined();
    expect(migrated.platforms.youtube).toBeDefined();
    expect(migrated.platforms.instagram).toBeDefined();
  });
});
