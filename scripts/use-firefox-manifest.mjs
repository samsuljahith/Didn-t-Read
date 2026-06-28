#!/usr/bin/env node
import { copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
copyFileSync(join(root, 'manifest.firefox.json'), join(root, 'manifest.json'));
console.log("Switched manifest.json to Firefox (MV2). Load unpacked in about:debugging.");
console.log('Restore Chromium manifest: npm run manifest:chrome');
