# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Test Commands

```bash
npm run build          # Build Chrome (MV3) and Firefox (MV2) extensions to dist/
npm run build:watch    # Watch mode for development
npm run test           # Run unit tests (Vitest)
npm run test:watch     # Run tests in watch mode
npm run test:e2e       # Run Playwright e2e tests
npm run test:all       # Run both unit and e2e tests
npm run lint           # ESLint
npm run clean          # Remove dist/
```

Run a single test file: `npx vitest run tests/unit/rules.test.ts`

## Architecture Overview

This is a browser extension that blocks algorithmic feeds while preserving utility features (DMs, search, subscriptions). It supports both Chrome (Manifest V3) and Firefox (Manifest V2).

### Blocking Modes

- **Hard block**: Navigation-level blocking via `webNavigation` API, redirects to blocked page or safe destination
- **Soft block**: DOM hiding via content scripts, uses MutationObserver for dynamic content

### Key Directories

```
src/
├── mv3/              # Chrome MV3 background service worker
├── mv2/              # Firefox MV2 background script
├── content/          # Content scripts per platform
│   ├── base.ts       # PlatformContentScript base class, messaging, DOM helpers
│   ├── router.ts     # SPA navigation detection (patches history API)
│   └── platforms/    # Platform-specific implementations
├── shared/           # Shared code between background and content
│   ├── types.ts      # TypeScript interfaces
│   ├── config.ts     # Default configs, URL rules, CSS selectors
│   ├── rules.ts      # URL pattern matching, block decisions
│   └── storage.ts    # Chrome storage wrapper
└── ui/               # Popup and blocked page
```

### Data Flow

1. **Background script** listens for navigation via `webNavigation.onBeforeNavigate` and `onHistoryStateUpdated`
2. **Rules engine** (`src/shared/rules.ts`) determines if URL should be blocked using pattern matching
3. Hard blocks redirect to blocked page or platform-specific safe destination
4. **Content scripts** handle soft blocks by hiding DOM elements using selectors from `config.ts`
5. **Router** (`src/content/router.ts`) detects SPA navigation by patching `history.pushState`/`replaceState`

### URL Pattern Matching

Patterns in `config.ts` support:
- Exact matches: `/home`
- Single segment wildcards: `/user/*` (matches `/user/john`, not `/user/john/posts`)
- Multi-segment wildcards: `/explore/**` (matches `/explore`, `/explore/tabs/for-you`)

### Platform Configuration

Each platform has:
- `hardBlocks`: Page-level navigation blocks (e.g., `home`, `shorts`, `trending`)
- `softBlocks`: DOM element hiding (e.g., `recommendations`, `endCards`)
- `redirectTarget`: Where to send blocked traffic (`'blocked'` for blocked page, or path like `/feed/subscriptions`)

### Adding a New Platform

1. Add platform ID to `PlatformId` type in `types.ts`
2. Add default config in `config.ts` (`PLATFORM_DEFAULT`)
3. Add URL rules (`PLATFORM_RULES`) and selectors (`PLATFORM_SELECTORS`) in `config.ts`
4. Create content script in `src/content/platforms/`
5. Add entries to `esbuild.config.js`
6. Add manifest entries (content_scripts, host_permissions)
7. For MV3: Add declarativeNetRequest rules JSON file

### Build Output

`npm run build` produces:
- `dist/chrome/` - Manifest V3 extension (Chrome, Edge)
- `dist/firefox/` - Manifest V2 extension (Firefox)
