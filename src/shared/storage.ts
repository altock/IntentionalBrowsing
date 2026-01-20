import type { PlatformConfig, PlatformId, StorageSchema } from './types.js';
import { DEFAULT_STORAGE, SCHEMA_VERSION } from './config.js';

const STORAGE_KEY = 'config';

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
      result.platforms[key] = { ...result.platforms[key], ...schema.platforms[key] };
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
    const result = await chrome.storage.local.get(STORAGE_KEY);
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
    await chrome.storage.local.set({ [STORAGE_KEY]: config });
  },

  /**
   * Update a specific platform's configuration
   */
  async updatePlatform(
    platformId: PlatformId,
    updates: Partial<PlatformConfig>
  ): Promise<StorageSchema> {
    const config = await this.load();
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
    };

    await this.save(config);
    return config;
  },

  /**
   * Toggle global enabled state
   */
  async toggleGlobal(enabled: boolean): Promise<StorageSchema> {
    const config = await this.load();
    config.globalEnabled = enabled;
    await this.save(config);
    return config;
  },

  /**
   * Increment block count and update last block timestamp
   */
  async incrementBlockCount(): Promise<StorageSchema> {
    const config = await this.load();
    config.stats.blocksTotal += 1;
    config.stats.lastBlock = Date.now();
    await this.save(config);
    return config;
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
