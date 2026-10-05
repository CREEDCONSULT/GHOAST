import { copyFileSync, mkdirSync } from 'node:fs';
mkdirSync('dist', { recursive: true });
copyFileSync('manifest.json', 'dist/manifest.json');
console.log('dist/ ready: manifest.json, background.js, content.js');
