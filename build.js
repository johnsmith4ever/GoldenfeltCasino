import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = __dirname;
const distDir = path.resolve(rootDir, 'dist');

console.log('Building Golden Felt Casino for production...');

// 1. Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// 2. Copy index.html to dist
const srcIndex = path.resolve(rootDir, 'index.html');
const distIndex = path.resolve(distDir, 'index.html');
fs.copyFileSync(srcIndex, distIndex);
console.log('✓ Copied index.html -> dist/index.html');

// 3. Copy assets directory to dist/assets
const srcAssets = path.resolve(rootDir, 'assets');
const distAssets = path.resolve(distDir, 'assets');
if (fs.existsSync(srcAssets)) {
  if (!fs.existsSync(distAssets)) {
    fs.mkdirSync(distAssets, { recursive: true });
  }
  fs.cpSync(srcAssets, distAssets, { recursive: true });
  console.log('✓ Copied assets/ -> dist/assets/');
}

// 4. Copy icon files to dist
const iconFiles = [
  'favicon.ico',
  'favicon.svg',
  'favicon-32x32.png',
  'favicon-16x16.png',
  'apple-touch-icon.png'
];

for (const icon of iconFiles) {
  const src = path.resolve(rootDir, icon);
  const dest = path.resolve(distDir, icon);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`✓ Copied ${icon} -> dist/${icon}`);
  }
}

// 5. Populate Vercel Build Output API v3 (.vercel/output/static & config.json)
try {
  const vercelOutputDir = path.resolve(rootDir, '.vercel', 'output');
  const vercelStaticDir = path.resolve(vercelOutputDir, 'static');

  if (!fs.existsSync(vercelStaticDir)) {
    fs.mkdirSync(vercelStaticDir, { recursive: true });
  }

  fs.cpSync(distDir, vercelStaticDir, { recursive: true });

  const vercelConfig = {
    version: 3,
    routes: [
      { handle: 'filesystem' },
      { src: '/(.*)', dest: '/index.html' }
    ]
  };

  fs.writeFileSync(
    path.resolve(vercelOutputDir, 'config.json'),
    JSON.stringify(vercelConfig, null, 2)
  );
  console.log('✓ Populated .vercel/output/static and config.json (Build Output API v3)');
} catch (err) {
  console.warn('Note: Could not write .vercel/output, standard dist/ remains ready.', err.message);
}

console.log('Build completed successfully! Deployable output is ready in dist/, root, and .vercel/output.');
