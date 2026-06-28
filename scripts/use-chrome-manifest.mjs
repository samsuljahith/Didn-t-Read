#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
execSync('git checkout manifest.json', { cwd: root, stdio: 'inherit' });
console.log('Restored Chromium manifest.json from git.');
