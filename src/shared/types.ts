/**
 * Platform identifiers supported by the extension
 */
export type PlatformId =
  | 'twitter'
  | 'reddit'
  | 'youtube'
  | 'instagram'
  | 'facebook'
  | 'linkedin'
  | 'tiktok';

/**
 * Blocking mode for a surface
 */
export type BlockMode = 'hard' | 'soft' | 'allow';

/**
 * Result of checking if a URL should be blocked
 */
export interface BlockDecision {
  shouldBlock: boolean;
  mode: BlockMode;
  redirectUrl?: string;
  reason?: string;
}

/**
 * Platform-specific configuration for hard blocks (page-level redirects)
 */
export interface HardBlockConfig {
  [path: string]: boolean;
}

/**
 * Platform-specific configuration for soft blocks (DOM hiding)
 */
export interface SoftBlockConfig {
  [feature: string]: boolean;
}

/**
 * Configuration for a single platform
 */
export interface PlatformConfig {
  enabled: boolean;
  hardBlocks: HardBlockConfig;
  softBlocks: SoftBlockConfig;
  redirectTarget: string;
  /** Platform-specific settings */
  customSettings?: Record<string, unknown>;
}

/**
 * YouTube-specific custom settings
 */
export interface YouTubeCustomSettings {
  disableAutoplay: boolean;
  shortsRedirectToWatch: boolean;
}

/**
 * Usage statistics
 */
export interface Stats {
  blocksTotal: number;
  lastBlock: number | null;
}

/**
 * Root storage schema
 */
export interface StorageSchema {
  schemaVersion: number;
  globalEnabled: boolean;
  platforms: Record<PlatformId, PlatformConfig>;
  stats: Stats;
}

/**
 * Selector configuration for DOM manipulation
 */
export interface SelectorConfig {
  primary: string;
  fallbacks: string[];
  description: string;
}

/**
 * Platform selectors for soft blocking
 */
export interface PlatformSelectors {
  [feature: string]: SelectorConfig;
}

/**
 * URL pattern for matching
 */
export interface UrlPattern {
  /** Path pattern (supports wildcards: * for single segment, ** for multiple) */
  pattern: string;
  /** Block mode if matched */
  mode: BlockMode;
  /** Optional redirect URL (for hard blocks) */
  redirect?: string;
  /** Description for debugging */
  description?: string;
}

/**
 * Platform URL rules
 */
export interface PlatformRules {
  /** Hostname patterns (e.g., 'twitter.com', '*.twitter.com') */
  hosts: string[];
  /** URL patterns to check */
  patterns: UrlPattern[];
  /** Default redirect target */
  defaultRedirect: string;
}

/**
 * Message types for communication between scripts
 */
export type MessageType =
  | 'GET_CONFIG'
  | 'SET_CONFIG'
  | 'CHECK_URL'
  | 'NAVIGATE'
  | 'GET_STATS'
  | 'INCREMENT_BLOCK_COUNT';

/**
 * Message payload for communication between scripts
 */
export interface ExtensionMessage {
  type: MessageType;
  payload?: unknown;
}

/**
 * Response from background script
 */
export interface ExtensionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
