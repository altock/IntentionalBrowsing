import type { PlatformConfig, PlatformId, StorageSchema } from './types.js';
import { DEFAULT_STORAGE, SCHEMA_VERSION } from './config.js';

const STORAGE_KEY = 'config';

/**
 * Deep clone a storage schema object
 */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Migrate old schema formats to current version
 */
export function migrateSchema(data: unknown): StorageSchema {
  // Handle null, undefined, or non-object
  if (!data || typeof data !== 'object') {
    return deepClone(DEFAULT_STORAGE);
  }

  const obj = data as Record<string, unknown>;

  // If already current schema version, return as-is (with type assertion)
  if (obj.schemaVersion === SCHEMA_VERSION) {
    // Fill in any missing platforms with defaults
    const schema = deepClone(obj) as StorageSchema;
    const defaults = deepClone(DEFAULT_STORAGE);

    // Merge in defaults for any missing platforms
    for (const key of Object.keys(defaults.platforms) as PlatformId[]) {
      if (!schema.platforms[key]) {
        schema.platforms[key] = defaults.platforms[key];
      } else {
        // Merge hard/soft blocks with defaults
        schema.platforms[key] = {
          ...defaults.platforms[key],
          ...schema.platforms[key],
          hardBlocks: {
            ...defaults.platforms[key].hardBlocks,
            ...schema.platforms[key].hardBlocks,
          },
          softBlocks: {
            ...defaults.platforms[key].softBlocks,
            ...schema.platforms[key].softBlocks,
          },
        };
      }
    }

    return {
      ...defaults,
      ...schema,
    };
  }

  // Migrate from schema version 0 (no version field, snake_case keys)
  if (!('schemaVersion' in obj) && 'global_enabled' in obj) {
    const migrated = deepClone(DEFAULT_STORAGE);
    migrated.globalEnabled = Boolean(obj.global_enabled);

    // Migrate old platform configs
    if (obj.platforms && typeof obj.platforms === 'object') {
      const oldPlatforms = obj.platforms as Record<string, Record<string, unknown>>;

      for (const [platformId, oldConfig] of Object.entries(oldPlatforms)) {
        if (platformId in migrated.platforms && oldConfig) {
          const pid = platformId as PlatformId;
          migrated.platforms[pid] = {
            ...migrated.platforms[pid],
            enabled: oldConfig.enabled !== undefined
              ? Boolean(oldConfig.enabled)
              : migrated.platforms[pid].enabled,
          };
        }
      }
    }

    return migrated;
  }

  // Unknown format, return defaults
  return deepClone(DEFAULT_STORAGE);
}

/**
 * Clean up expired pauses
 */
function cleanExpiredPauses(config: StorageSchema): StorageSchema {
  const now = Date.now();
  const updated = { ...config };

  // Clear expired global pause
  if (updated.pause.globalUntil && updated.pause.globalUntil < now) {
    updated.pause = { ...updated.pause, globalUntil: null };
  }

  // Clear expired platform pauses
  const platforms = { ...updated.pause.platforms };
  let platformsChanged = false;

  for (const [platform, until] of Object.entries(platforms)) {
    if (until && until < now) {
      delete platforms[platform as PlatformId];
      platformsChanged = true;
    }
  }

  if (platformsChanged) {
    updated.pause = { ...updated.pause, platforms };
  }

  return updated;
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
    const cleaned = cleanExpiredPauses(migrated);

    // Save if migrations or cleaning occurred
    if (JSON.stringify(result[STORAGE_KEY]) !== JSON.stringify(cleaned)) {
      await this.save(cleaned);
    }

    return cleaned;
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
   * Set pause timer (global or per-platform)
   */
  async setPause(until: number, platformId?: PlatformId): Promise<StorageSchema> {
    const config = await this.load();

    if (platformId) {
      config.pause.platforms[platformId] = until;
    } else {
      config.pause.globalUntil = until;
    }

    await this.save(config);
    return config;
  },

  /**
   * Clear pause timer (global or per-platform)
   */
  async clearPause(platformId?: PlatformId): Promise<StorageSchema> {
    const config = await this.load();

    if (platformId) {
      delete config.pause.platforms[platformId];
    } else {
      config.pause.globalUntil = null;
    }

    await this.save(config);
    return config;
  },

  /**
   * Check if blocking is currently paused
   */
  isPaused(config: StorageSchema, platformId?: PlatformId): boolean {
    const now = Date.now();

    // Check global pause
    if (config.pause.globalUntil && config.pause.globalUntil > now) {
      return true;
    }

    // Check platform-specific pause
    if (platformId) {
      const platformPause = config.pause.platforms[platformId];
      if (platformPause && platformPause > now) {
        return true;
      }
    }

    return false;
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
