import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync, existsSync, readdirSync, cpSync } from 'fs';
import { join, dirname } from 'path';

const isWatch = process.argv.includes('--watch');

const commonOptions = {
  bundle: true,
  sourcemap: true,
  target: 'es2022',
  format: 'esm',
};

// MV3 (Chrome) build
const mv3Entries = {
  'background': 'src/mv3/background.ts',
  'content/twitter': 'src/content/platforms/twitter.ts',
  'content/reddit': 'src/content/platforms/reddit.ts',
  'content/youtube': 'src/content/platforms/youtube.ts',
  'content/instagram': 'src/content/platforms/instagram.ts',
  'content/facebook': 'src/content/platforms/facebook.ts',
  'content/linkedin': 'src/content/platforms/linkedin.ts',
  'content/tiktok': 'src/content/platforms/tiktok.ts',
  'ui/popup': 'src/ui/popup.ts',
  'ui/blocked': 'src/ui/blocked.ts',
};

// MV2 (Firefox) build
const mv2Entries = {
  'background': 'src/mv2/background.ts',
  'content/twitter': 'src/content/platforms/twitter.ts',
  'content/reddit': 'src/content/platforms/reddit.ts',
  'content/youtube': 'src/content/platforms/youtube.ts',
  'content/instagram': 'src/content/platforms/instagram.ts',
  'content/facebook': 'src/content/platforms/facebook.ts',
  'content/linkedin': 'src/content/platforms/linkedin.ts',
  'content/tiktok': 'src/content/platforms/tiktok.ts',
  'ui/popup': 'src/ui/popup.ts',
  'ui/blocked': 'src/ui/blocked.ts',
};

function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function copyStaticFiles(targetDir, includeMv3Rules = false) {
  // Copy HTML files
  const htmlFiles = ['popup.html', 'blocked.html'];
  htmlFiles.forEach(file => {
    const src = join('src/ui', file);
    if (existsSync(src)) {
      copyFileSync(src, join(targetDir, 'ui', file));
    }
  });

  // Copy CSS files
  const cssFiles = ['popup.css', 'blocked.css'];
  cssFiles.forEach(file => {
    const src = join('src/ui', file);
    if (existsSync(src)) {
      copyFileSync(src, join(targetDir, 'ui', file));
    }
  });

  // Copy icons if they exist
  const iconsDir = 'src/icons';
  if (existsSync(iconsDir)) {
    cpSync(iconsDir, join(targetDir, 'icons'), { recursive: true });
  }

  // Copy MV3 rules if needed
  if (includeMv3Rules) {
    const rulesDir = 'src/mv3/rules';
    if (existsSync(rulesDir)) {
      ensureDir(join(targetDir, 'rules'));
      cpSync(rulesDir, join(targetDir, 'rules'), { recursive: true });
    }
  }
}

async function buildExtension(name, entries, manifestSrc, outDir, options = {}) {
  ensureDir(outDir);
  ensureDir(join(outDir, 'ui'));
  ensureDir(join(outDir, 'content'));

  const entryPoints = Object.entries(entries).map(([out, src]) => ({
    in: src,
    out,
  }));

  // Filter to only existing entry points
  const existingEntries = entryPoints.filter(e => existsSync(e.in));

  if (existingEntries.length === 0) {
    console.log(`No entry points found for ${name}, skipping...`);
    return;
  }

  try {
    if (isWatch) {
      const ctx = await esbuild.context({
        ...commonOptions,
        entryPoints: existingEntries,
        outdir: outDir,
      });
      await ctx.watch();
      console.log(`Watching ${name}...`);
    } else {
      await esbuild.build({
        ...commonOptions,
        entryPoints: existingEntries,
        outdir: outDir,
      });
      console.log(`Built ${name}`);
    }

    // Copy manifest
    if (existsSync(manifestSrc)) {
      copyFileSync(manifestSrc, join(outDir, 'manifest.json'));
    }

    // Copy static files
    copyStaticFiles(outDir, options.includeMv3Rules || false);
  } catch (err) {
    console.error(`Failed to build ${name}:`, err);
    if (!isWatch) process.exit(1);
  }
}

async function main() {
  await Promise.all([
    buildExtension('Chrome (MV3)', mv3Entries, 'src/mv3/manifest.json', 'dist/chrome', { includeMv3Rules: true }),
    buildExtension('Firefox (MV2)', mv2Entries, 'src/mv2/manifest.json', 'dist/firefox'),
  ]);

  if (!isWatch) {
    console.log('Build complete!');
  }
}

main();
