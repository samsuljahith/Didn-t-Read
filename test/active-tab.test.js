import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function loadResolveTab() {
  const context = { globalThis: {} };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(readFileSync(join(ROOT, 'lib/active-tab.js'), 'utf8'), context);
  return context.resolveTabForSidePanel;
}

describe('resolveTabForSidePanel()', () => {
  const resolve = loadResolveTab();

  it('detects tab switch when active tab id differs', () => {
    const result = resolve(10, 20, 'https://a.com/terms', 'https://b.com/terms');
    assert.equal(result.tabId, 20);
    assert.equal(result.pageUrl, 'https://b.com/terms');
    assert.equal(result.changed, true);
  });

  it('detects url change on same tab', () => {
    const result = resolve(10, 10, 'https://a.com/old', 'https://a.com/new');
    assert.equal(result.changed, true);
    assert.equal(result.pageUrl, 'https://a.com/new');
  });

  it('returns unchanged when tab and url match', () => {
    const result = resolve(10, 10, 'https://a.com/terms', 'https://a.com/terms');
    assert.equal(result.changed, false);
  });
});
