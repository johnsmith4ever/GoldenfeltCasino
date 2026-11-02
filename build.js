import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = __dirname;
const distDir = path.resolve(rootDir, 'dist');

console.log('Building Golden Felt Casino for production...');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy index.html to dist
const srcIndex = path.resolve(rootDir, 'index.html');
const distIndex = path.resolve(distDir, 'index.html');
fs.copyFileSync(srcIndex, distIndex);
console.log('✓ Copied index.html -> dist/index.html');

// Copy assets directory to dist/assets
const srcAssets = path.resolve(rootDir, 'assets');
const distAssets = path.resolve(distDir, 'assets');
if (fs.existsSync(srcAssets)) {
  if (!fs.existsSync(distAssets)) {
    fs.mkdirSync(distAssets, { recursive: true });
  }
  fs.cpSync(srcAssets, distAssets, { recursive: true });
  console.log('✓ Copied assets/ -> dist/assets/');
}

console.log('Build completed successfully! Deployable output is ready in dist/ and root.');
