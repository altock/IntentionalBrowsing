import type { PlatformId, StorageSchema } from './types.js';

/**
 * Whether a stored change affects the current platform's blocking behavior.
 */
export function havePlatformSettingsChanged(
  platformId: PlatformId,
  previousConfig?: StorageSchema | null,
  nextConfig?: StorageSchema | null
): boolean {
  if (!previousConfig || !nextConfig) {
    return true;
  }

  return (
    previousConfig.globalEnabled !== nextConfig.globalEnabled ||
    JSON.stringify(previousConfig.platforms[platformId]) !==
      JSON.stringify(nextConfig.platforms[platformId])
  );
}

/**
 * Whether YouTube content-script blocking behavior should run.
 */
export function shouldApplyYouTubeContentBlocking(config?: StorageSchema | null): boolean {
  if (!config) {
    return false;
  }

  const youtubeConfig = config.platforms.youtube;
  return config.globalEnabled && youtubeConfig.enabled && youtubeConfig.redirectTarget === 'feed-block';
}

/**
 * Normalize Twitter/X list path input into a canonical site-relative path.
 */
export function normalizeTwitterListPath(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  let path = trimmed;

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const host = parsed.hostname.toLowerCase();
      const isTwitterHost =
        host === 'x.com' || host === 'www.x.com' || host === 'twitter.com' || host === 'www.twitter.com';

      if (!isTwitterHost) {
        return null;
      }

      path = parsed.pathname;
    } catch {
      return null;
    }
  }

  if (!path.startsWith('/')) {
    path = `/${path}`;
  }

  const normalizedPath = path.replace(/\/+$/, '');
  const isListPath =
    /^\/i\/lists\/[A-Za-z0-9_-]+$/.test(normalizedPath) ||
    /^\/[A-Za-z0-9_]+\/lists\/[A-Za-z0-9_-]+$/.test(normalizedPath);

  return isListPath ? normalizedPath : null;
}
