# Intentional Browsing Extension Spec

## Core Philosophy

The goal is **intentional use**, not abstinence. Block algorithmic feeds and infinite scroll surfaces while preserving utility: DMs, direct links, search, subscriptions you chose.

Two blocking modes:
1. **Hard block** - navigation blocked, redirect to blocked page
2. **Soft block** - DOM hiding (content invisible but page loads)

Hard blocks are more robust but break SPA navigation. Soft blocks work better for in-app features but can be bypassed/broken by site updates.

---

## Platform Configs

### X/Twitter

| Surface | Default | Action |
|---------|---------|--------|
| `/` and `/home` | BLOCK | Hard redirect |
| `/explore` | BLOCK | Hard redirect |
| `/search` | ALLOW | - |
| `/notifications` | ALLOW | - |
| `/messages` | ALLOW | - |
| `/{user}` profiles | ALLOW | - |
| `/{user}/status/{id}` tweets | ALLOW | - |
| For You tab | BLOCK | Soft block, redirect to Following |
| Trends sidebar | HIDE | Soft block |
| "Who to follow" | HIDE | Soft block |

**Redirect target:** `/messages` or last allowed page

---

### Reddit

| Surface | Default | Action |
|---------|---------|--------|
| `/` root | BLOCK | Hard redirect |
| `/home` | BLOCK | Hard redirect |
| `/popular` | BLOCK | Hard redirect |
| `/all` | BLOCK | Hard redirect |
| `/r/{subreddit}` | ALLOW | (with blacklist option) |
| `/r/{sub}/comments/{id}` | ALLOW | - |
| `/user/{name}` | ALLOW | - |
| `/search` | ALLOW | - |
| Specific subreddits | CONFIGURABLE | User blacklist |

**Subreddit blacklist defaults:** (none, but easy to add)
**Redirect target:** blocked page or `/r/all` (ironic but forces intentionality)

---

### Instagram

| Surface | Default | Action |
|---------|---------|--------|
| `/` feed | BLOCK | Soft block feed, keep header |
| `/explore` | BLOCK | Hard redirect |
| `/reels` | BLOCK | Hard redirect |
| `/direct/inbox` | ALLOW | - |
| `/{user}` profiles | ALLOW | - |
| `/p/{id}` posts | ALLOW | - |
| `/stories/{user}` | CONFIGURABLE | Default: ALLOW |
| "For You" feed | REDIRECT | To "Following" feed |
| Suggested posts | HIDE | Soft block |
| "Suggested for you" follows | HIDE | Soft block |

**Redirect target:** `/direct/inbox/`

---

### YouTube

| Surface | Default | Action |
|---------|---------|--------|
| `/` homepage | BLOCK | Soft block (show search only) |
| `/shorts/{id}` | BLOCK | Redirect to `/watch?v={id}` |
| `/shorts` tab | BLOCK | Hard redirect |
| `/feed/subscriptions` | ALLOW | Primary destination |
| `/feed/trending` | BLOCK | Hard redirect |
| `/feed/explore` | BLOCK | Hard redirect |
| `/watch?v={id}` | ALLOW | - |
| `/@{channel}` | ALLOW | - |
| `/results?search_query=` | ALLOW | - |
| Homepage recommendations | HIDE | Soft block |
| Sidebar recommendations | HIDE | Soft block |
| End screen suggestions | HIDE | Soft block |
| Shorts in feed | HIDE | Soft block |
| Autoplay | DISABLE | - |
| Comments | CONFIGURABLE | Default: SHOW |

**Redirect target:** `/feed/subscriptions`

---

### Facebook

| Surface | Default | Action |
|---------|---------|--------|
| `/` feed | BLOCK | Soft block (show header) |
| `/watch` | BLOCK | Hard redirect |
| `/reels` | BLOCK | Hard redirect |
| `/marketplace` | ALLOW | - |
| `/groups/{id}` | ALLOW | - |
| `/messages` | ALLOW | - |
| `/events` | ALLOW | - |
| `/{user}` profiles | ALLOW | - |
| News feed | HIDE | Replace with quote |
| "People you may know" | HIDE | Soft block |
| Stories | CONFIGURABLE | Default: HIDE |

**Redirect target:** `/messages/`

---

### LinkedIn

| Surface | Default | Action |
|---------|---------|--------|
| `/feed` | BLOCK | Soft block |
| `/in/{user}` | ALLOW | - |
| `/messaging` | ALLOW | - |
| `/jobs` | ALLOW | - |
| `/mynetwork` | CONFIGURABLE | Default: ALLOW |
| News feed | HIDE | Replace with quote |
| "People you may know" | HIDE | Soft block |

**Redirect target:** `/messaging/`

---

### TikTok

| Surface | Default | Action |
|---------|---------|--------|
| Entire site | BLOCK | Hard redirect to blocked page |
| `/messages` | CONFIGURABLE | Default: BLOCK |
| `/@{user}` | CONFIGURABLE | Default: BLOCK |

TikTok is basically 100% feed. Default: block everything. Option to allow profiles/DMs for power users.

---

### Hacker News

| Surface | Default | Action |
|---------|---------|--------|
| `/` front page | CONFIGURABLE | Default: ALLOW |
| `/newest` | ALLOW | - |
| `/item?id=` | ALLOW | - |
| `/user?id=` | ALLOW | - |

HN is less algorithmically toxic but can be a time sink. Optional inclusion.

---

## UI/UX

### Popup Interface

```
┌─────────────────────────────┐
│  🎯 Intentional Browsing    │
│  ─────────────────────────  │
│                             │
│  ● Global: ON               │
│                             │
│  X/Twitter     [✓] [⚙]     │
│  Reddit        [✓] [⚙]     │
│  Instagram     [✓] [⚙]     │
│  YouTube       [✓] [⚙]     │
│  Facebook      [ ] [⚙]     │
│  LinkedIn      [ ] [⚙]     │
│  TikTok        [✓] [⚙]     │
│                             │
│  [Pause 5min] [Pause 1hr]  │
│                             │
└─────────────────────────────┘
```

- Main toggles per platform
- Gear icon opens platform-specific config
- Pause buttons for timed breaks (no permanent disable in UI)
- No "inspirational quotes" by default (cringe), but optional

### Platform Config Panel

```
┌─────────────────────────────┐
│  ⚙ Reddit Settings          │
│  ─────────────────────────  │
│                             │
│  Block:                     │
│  [✓] Home/Popular/All      │
│  [ ] All subreddit feeds   │
│                             │
│  Blocked subreddits:        │
│  ┌─────────────────────┐   │
│  │ neoliberal          │ ✕ │
│  │ politics            │ ✕ │
│  │ worldnews           │ ✕ │
│  └─────────────────────┘   │
│  [+ Add subreddit]         │
│                             │
│  [Reset to defaults]       │
└─────────────────────────────┘
```

### Blocked Page

Minimal. No guilt-tripping.

```
┌─────────────────────────────────────┐
│                                     │
│              🎯                     │
│                                     │
│     This feed is blocked.          │
│                                     │
│     [Go back]  [Subscriptions]     │
│                                     │
│     Paused until: --               │
│                                     │
└─────────────────────────────────────┘
```

---

## Technical Architecture

### Manifest V3 Compatible

Use `declarativeNetRequest` for hard blocks where possible (more performant, survives service worker sleep).

Use content scripts for soft blocks (DOM manipulation).

### File Structure

```
/manifest.json
/background.js          # Service worker, navigation interception
/rules/
  twitter.json          # declarativeNetRequest rules
  reddit.json
  ...
/content/
  twitter.js            # DOM manipulation for soft blocks
  youtube.js
  instagram.js
  ...
/popup/
  popup.html
  popup.js
  popup.css
/options/
  options.html          # Full settings page
  options.js
/blocked.html           # Blocked page
/lib/
  storage.js            # Chrome storage wrapper
  config.js             # Default configs
```

### Storage Schema

```javascript
{
  "global_enabled": true,
  "platforms": {
    "twitter": {
      "enabled": true,
      "block_home": true,
      "block_explore": true,
      "block_for_you": true,
      "hide_trends": true,
      "hide_who_to_follow": true,
      "redirect_target": "/messages"
    },
    "reddit": {
      "enabled": true,
      "block_home": true,
      "block_popular": true,
      "block_all": true,
      "blocked_subreddits": ["neoliberal", "politics"],
      "redirect_target": "blocked"
    },
    "youtube": {
      "enabled": true,
      "block_home": true,
      "block_shorts": true,
      "block_trending": true,
      "hide_recommendations": true,
      "hide_end_cards": true,
      "disable_autoplay": true,
      "redirect_target": "/feed/subscriptions"
    },
    // ...
  },
  "pause_until": null,  // ISO timestamp or null
  "stats": {
    "blocks_today": 0,
    "blocks_total": 0
  }
}
```

---

## Implementation Priority

### Phase 1: MVP
- X/Twitter hard blocks
- Reddit hard blocks + subreddit blacklist  
- YouTube hard blocks + shorts redirect
- Basic popup UI
- Blocked page

### Phase 2: Soft Blocks
- YouTube DOM hiding (recommendations, end cards)
- Instagram feed/explore blocking
- Twitter "For You" -> "Following" redirect

### Phase 3: Polish
- Per-platform config UI
- Pause functionality
- Stats tracking
- Facebook/LinkedIn support

### Phase 4: Nice-to-have
- Sync settings across devices
- Import/export config
- Scheduled blocking (e.g., work hours only)
- Allowlist for specific URLs

---

## Anti-Patterns to Avoid

1. **Guilt-tripping** - No "YOU SHOULD BE WORKING" messages
2. **Gamification** - No streaks, no achievements, no "you saved X hours"
3. **Friction theater** - No "type FOCUS to continue" nonsense
4. **Over-configuration** - Sensible defaults, don't require setup
5. **Quote spam** - Optional, off by default
6. **Easy bypass** - No permanent disable in popup, require options page
7. **Notification spam** - Zero notifications

---

## Open Questions

1. Should there be a "nuclear option" that blocks entire domains?
2. Should pause times be configurable or fixed (5m/1h/1d)?
3. Support for custom sites beyond the big platforms?
4. Firefox support? (Manifest V2 still works there)
5. Mobile companion? (Limited capability via Kiwi/Firefox Android)
