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

async function readMigratedConfig(): Promise<{ config: StorageSchema; needsMigration: boolean }> {
  const result = await getStorageApi().get(STORAGE_KEY) || {};
  const config = migrateSchema(result[STORAGE_KEY]);

  return {
    config,
    needsMigration: JSON.stringify(result[STORAGE_KEY]) !== JSON.stringify(config),
  };
}

async function saveNow(config: StorageSchema): Promise<void> {
  await getStorageApi().set({ [STORAGE_KEY]: config });
}

function enqueueConfigOperation<T>(operation: () => Promise<T>): Promise<T> {
  const result = updateQueue
    .catch(() => undefined)
    .then(operation);

  updateQueue = result.then(
    () => undefined,
    () => undefined
  );

  return result;
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
    return enqueueConfigOperation(async () => {
      const { config, needsMigration } = await readMigratedConfig();
      if (needsMigration) {
        await saveNow(config);
      }

      return config;
    });
  },

  /**
   * Save configuration to storage
   */
  async save(config: StorageSchema): Promise<void> {
    await enqueueConfigOperation(() => saveNow(config));
  },

  /**
   * Read, update, and save configuration in invocation order.
   */
  async update(
    updater: (config: StorageSchema) => StorageSchema | void
  ): Promise<StorageSchema> {
    return enqueueConfigOperation(async () => {
      const { config } = await readMigratedConfig();
      const updated = updater(config) ?? config;
      await saveNow(updated);
      return updated;
    });
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
