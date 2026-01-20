# Intentional Browsing

A browser extension that blocks algorithmic feeds while preserving the features you actually use—DMs, search, subscriptions, and direct links.

## What it does

| Platform | Blocked | Allowed |
|----------|---------|---------|
| X/Twitter | Home feed, For You | Messages, notifications, profiles, individual tweets |
| Reddit | Home, Popular, r/all | Subreddits, comments, search, user profiles |
| YouTube | Home, Shorts, Trending | Subscriptions, watch pages, search, channels |
| Instagram | Feed, Explore, Reels | DMs, profiles, individual posts |
| Facebook | Feed, Watch, Reels | Messages, groups, events, marketplace |
| LinkedIn | Feed | Messages, jobs, profiles |
| TikTok | Everything | — |

## Install

- **Chrome**: [Chrome Web Store](https://chrome.google.com/webstore/detail/intentional-browsing) (pending)
- **Firefox**: Coming soon

Or load unpacked from `dist/chrome` or `dist/firefox` after building.

## Build

```bash
npm install
npm run build        # Build both Chrome and Firefox
npm run build:watch  # Watch mode
```

Output:
- `dist/chrome/` — Manifest V3 (Chrome, Edge)
- `dist/firefox/` — Manifest V2 (Firefox)

## Test

```bash
npm test             # Unit tests (Vitest)
npm run test:e2e     # E2E tests (Playwright)
```

## How it works

**Hard blocks**: Navigation-level blocking via `webNavigation` API. Redirects to a blocked page or safe destination (e.g., YouTube → Subscriptions).

**Soft blocks**: DOM hiding via content scripts with MutationObserver for dynamic content.

The extension detects SPA navigation by patching `history.pushState`/`replaceState` to catch in-app route changes.

## Privacy

No data collection. No analytics. Everything stays local. See [Privacy Policy](https://altock.github.io/IntentionalBrowsing/privacy.html).

## License

MIT
