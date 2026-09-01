import type { PlatformConfig, PlatformId, StorageSchema } from './types.js';
import { DEFAULT_STORAGE, SCHEMA_VERSION } from './config.js';

declare const browser: typeof chrome | undefined;

const STORAGE_KEY = 'config';
let updateQueue: Promise<void> = Promise.resolve();

// Use browser API (Firefox) if available, otherwise chrome (Chrome/Edge)
function getStorageApi() {
  return typeof browser !== 'undefined' ? browser.storage.local : chrome.storage.local;
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Ensure stored config has all current schema fields
 */
export function migrateSchema(data: unknown): StorageSchema {
  if (!data || typeof data !== 'object') {
    return deepClone(DEFAULT_STORAGE);
  }

  const obj = data as Record<string, unknown>;
  if (obj.schemaVersion !== SCHEMA_VERSION) {
    return deepClone(DEFAULT_STORAGE);
  }

  // Deep clone defaults and merge with stored data
  const result = deepClone(DEFAULT_STORAGE);
  const schema = obj as unknown as StorageSchema;

  result.globalEnabled = schema.globalEnabled;
  result.stats = schema.stats ? deepClone(schema.stats) : result.stats;

  for (const key of Object.keys(result.platforms) as PlatformId[]) {
    if (schema.platforms?.[key]) {
      const defaults = result.platforms[key];
      const stored = schema.platforms[key];
      result.platforms[key] = {
        ...defaults,
        ...stored,
        hardBlocks: {
          ...defaults.hardBlocks,
          ...(stored.hardBlocks ?? {}),
        },
        softBlocks: {
          ...defaults.softBlocks,
          ...(stored.softBlocks ?? {}),
        },
        customSettings:
          defaults.customSettings || stored.customSettings
            ? {
                ...(defaults.customSettings ?? {}),
                ...(stored.customSettings ?? {}),
              }
            : undefined,
      };
    }
  }

  return result;
}

/**
 * Storage abstraction for Chrome extension storage
 */
export const Storage = {
  /**
   * Load configuration from storage, applying migrations and defaults
   */
  async load(): Promise<StorageSchema> {
    const result = await getStorageApi().get(STORAGE_KEY) || {};
    const migrated = migrateSchema(result[STORAGE_KEY]);

    // Save if migrations occurred
    if (JSON.stringify(result[STORAGE_KEY]) !== JSON.stringify(migrated)) {
      await this.save(migrated);
    }

    return migrated;
  },

  /**
   * Save configuration to storage
   */
  async save(config: StorageSchema): Promise<void> {
    await getStorageApi().set({ [STORAGE_KEY]: config });
  },

  /**
   * Read, update, and save configuration in invocation order.
   */
  async update(
    updater: (config: StorageSchema) => StorageSchema | void
  ): Promise<StorageSchema> {
    let resolveResult: (config: StorageSchema) => void;
    let rejectResult: (error: unknown) => void;
    const result = new Promise<StorageSchema>((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
    });

    updateQueue = updateQueue
      .catch(() => undefined)
      .then(async () => {
        try {
          const current = await this.load();
          const updated = updater(current) ?? current;
          await this.save(updated);
          resolveResult(updated);
        } catch (error) {
          rejectResult(error);
        }
      });

    return result;
  },

  /**
   * Update a specific platform's configuration
   */
  async updatePlatform(
    platformId: PlatformId,
    updates: Partial<PlatformConfig>
  ): Promise<StorageSchema> {
    return this.update((config) => {
      const currentPlatform = config.platforms[platformId];

      config.platforms[platformId] = {
        ...currentPlatform,
        ...updates,
        hardBlocks: {
          ...currentPlatform.hardBlocks,
          ...(updates.hardBlocks || {}),
        },
        softBlocks: {
          ...currentPlatform.softBlocks,
          ...(updates.softBlocks || {}),
        },
        customSettings: {
          ...(currentPlatform.customSettings ?? {}),
          ...(updates.customSettings ?? {}),
        },
      };

      return config;
    });
  },

  /**
   * Toggle global enabled state
   */
  async toggleGlobal(enabled: boolean): Promise<StorageSchema> {
    return this.update((config) => {
      config.globalEnabled = enabled;
      return config;
    });
  },

  /**
   * Increment block count and update last block timestamp
   */
  async incrementBlockCount(): Promise<StorageSchema> {
    return this.update((config) => {
      config.stats.blocksTotal += 1;
      config.stats.lastBlock = Date.now();
      return config;
    });
  },

  /**
   * Reset to default configuration
   */
  async reset(): Promise<StorageSchema> {
    const config = deepClone(DEFAULT_STORAGE);
    await this.save(config);
    return config;
  },
};
