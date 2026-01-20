# Improvement Plan

## Lessons from MVP Comparison

The original MVP at `~/Downloads/x-home-blocker/` accomplished the core goal in **73 lines**:
- `webNavigation.onBeforeNavigate` for initial page loads
- `webNavigation.onHistoryStateUpdated` for SPA navigation
- No content scripts needed for hard blocking
- No build step, no TypeScript, no storage abstraction

**Key insight:** `webNavigation.onHistoryStateUpdated` handles SPA navigation natively. The content script router that patches `history.pushState` is unnecessary complexity for hard blocking.

## Current Issues

### 1. Over-engineered architecture
- 43 files vs 3 files for equivalent functionality
- TypeScript + build step when plain JS would work
- Storage with migrations when hardcoded config is fine for MVP
- Content scripts for hard blocking when webNavigation API suffices

### 2. Untested against real sites
- CSS selectors for soft blocking are guesses
- Never loaded in a browser to verify
- No E2E tests

### 3. Technical issues
- SVG icons won't work in Chrome (requires PNG)
- No `tsc --noEmit` check for type errors
- MutationObserver without debouncing

## Improvement Steps

### Phase 1: Verify it actually works
- [ ] Generate PNG icons (or use a simple icon generator)
- [ ] Run `tsc --noEmit` to check for type errors
- [ ] Load extension in Chrome, verify hard blocks work
- [ ] Load extension in Firefox, verify hard blocks work
- [ ] Test SPA navigation on Twitter (click Home while on /messages)

### Phase 2: Fix CSS selectors
- [ ] Open Twitter in DevTools, verify/fix selectors for:
  - Trends sidebar
  - Who to follow
  - For You tab switcher
- [ ] Open YouTube in DevTools, verify/fix selectors for:
  - Homepage recommendations grid
  - Sidebar recommendations
  - End cards
  - Shorts in feed
- [ ] Open Instagram in DevTools, verify/fix selectors
- [ ] Document which selectors are verified vs guessed

### Phase 3: Simplify architecture
Consider whether the complexity is justified:
- [ ] Could replace content script router with just `webNavigation.onHistoryStateUpdated`?
- [ ] Is TypeScript worth the build step for this project?
- [ ] Is the storage abstraction with migrations needed for MVP?
- [ ] Could soft blocks use simpler inline styles vs full content scripts?

### Phase 4: Add E2E tests
- [ ] Set up Playwright with extension loading
- [ ] Test: Navigate to twitter.com → redirected to blocked page or /messages
- [ ] Test: Navigate to twitter.com/messages → allowed
- [ ] Test: Click "Home" link on Twitter → blocked (SPA nav)
- [ ] Test: Toggle platform off in popup → no longer blocked
- [ ] Test: Pause 5min → sites accessible, then blocked again

### Phase 5: Performance
- [ ] Add debouncing to MutationObserver in content scripts
- [ ] Profile content scripts on heavy pages (Twitter feed)
- [ ] Consider using `requestIdleCallback` for non-critical DOM operations

## Questions to Resolve

1. **Is declarativeNetRequest worth it?**
   - Pro: Works even if service worker sleeps, more efficient
   - Con: Less flexible, harder to debug, can't do dynamic per-platform toggles easily
   - The MVP uses webNavigation which is simpler and handles the use case

2. **Should soft blocks be a separate extension?**
   - Hard blocks (redirects) are simple and stable
   - Soft blocks (DOM hiding) are fragile and site-specific
   - Maybe ship hard blocks first, soft blocks as optional Phase 2

3. **Is cross-browser support (MV2/MV3) worth the complexity?**
   - Firefox market share is small
   - Could ship Chrome-only MVP, add Firefox later
   - Maintaining two manifests and background scripts doubles complexity

## Recommended Next Steps

1. **Immediate:** Load in Chrome, verify hard blocks work
2. **This week:** Fix PNG icons, verify selectors on real sites
3. **Before v1.0:** Add E2E tests for core flows
4. **Consider:** Simplifying to webNavigation-only approach like the MVP
