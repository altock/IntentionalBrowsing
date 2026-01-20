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

    it('should return defaults for unrecognized schema', async () => {
      // Simulate old/unknown schema
      const oldConfig = {
        some_unknown_field: true,
      };
      mockStorage['config'] = oldConfig;

      const config = await Storage.load();

      // Should return defaults for unrecognized schema
      expect(config.schemaVersion).toBe(SCHEMA_VERSION);
      expect(config.globalEnabled).toBe(DEFAULT_STORAGE.globalEnabled);
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
      // Platform should still be enabled
      expect(saved.platforms.twitter.enabled).toBe(true);
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

  it('should return defaults for unknown schema format', () => {
    const unknownSchema = {
      global_enabled: false,
      some_field: 'value',
    };

    const migrated = migrateSchema(unknownSchema);

    // Should return defaults when schema version doesn't match
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
    expect(migrated.globalEnabled).toBe(DEFAULT_STORAGE.globalEnabled);
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
      stats: DEFAULT_STORAGE.stats,
    };

    const migrated = migrateSchema(partialSchema);

    // Should have all platforms
    expect(migrated.platforms.reddit).toBeDefined();
    expect(migrated.platforms.youtube).toBeDefined();
    expect(migrated.platforms.instagram).toBeDefined();
  });
});
