import type { ConfigUpdate, StorageSchema } from './types.js';

/**
 * Apply one popup setting change without replacing unrelated stored state.
 */
export function applyConfigUpdate(config: StorageSchema, update: ConfigUpdate): StorageSchema {
  if (update.kind === 'global-enabled') {
    return {
      ...config,
      globalEnabled: update.enabled,
    };
  }

  const currentPlatform = config.platforms[update.platformId];
  let updatedPlatform = currentPlatform;

  switch (update.kind) {
    case 'platform-enabled':
      updatedPlatform = { ...currentPlatform, enabled: update.enabled };
      break;
    case 'platform-redirect-target':
      updatedPlatform = { ...currentPlatform, redirectTarget: update.redirectTarget };
      break;
    case 'platform-custom-settings':
      updatedPlatform = {
        ...currentPlatform,
        customSettings: {
          ...(currentPlatform.customSettings ?? {}),
          ...update.customSettings,
        },
      };
      break;
  }

  return {
    ...config,
    platforms: {
      ...config.platforms,
      [update.platformId]: updatedPlatform,
    },
  };
}
