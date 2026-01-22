# Source Code Build Instructions

## Requirements

- **OS:** macOS, Linux, or Windows
- **Node.js:** v18.0.0 or higher
- **npm:** v9.0.0 or higher

## Build Steps

1. Install dependencies:
   ```
   npm install
   ```

2. Build the extension:
   ```
   npm run build
   ```

3. The Firefox extension will be in `dist/firefox/`

## Build Script

The build uses `esbuild.config.js` which:
- Compiles TypeScript to JavaScript
- Bundles content scripts and background scripts
- Copies static assets (HTML, CSS, icons, manifest)

## Output

After running `npm run build`, the Firefox extension files are located at:
```
dist/firefox/
├── manifest.json
├── background.js
├── ui/
│   ├── popup.html
│   ├── popup.js
│   ├── popup.css
│   ├── blocked.html
│   ├── blocked.js
│   └── blocked.css
├── content/
│   ├── twitter.js
│   ├── reddit.js
│   ├── youtube.js
│   ├── instagram.js
│   ├── facebook.js
│   ├── linkedin.js
│   └── tiktok.js
└── icons/
    └── *.png
```
