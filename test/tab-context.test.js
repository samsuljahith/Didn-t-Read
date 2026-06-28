import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

/** @type {Record<string, unknown>} */
let storageData;

const chromeMock = {
  storage: {
    session: {
      get: async (keys) => {
        if (typeof keys === 'string') {
          return { [keys]: storageData[keys] ?? undefined };
        }
        return { ...storageData };
      },
      set: async (items) => {
        Object.assign(storageData, items);
      },
      remove: async (keys) => {
        const list = Array.isArray(keys) ? keys : [keys];
        for (const key of list) {
          delete storageData[key];
        }
      },
    },
    local: {
      get: async () => ({}),
      set: async () => {},
    },
  },
};

function loadStorage() {
  storageData = {};
  const context = {
    globalThis: {},
    chrome: chromeMock,
    getProviderConfig: () => ({
      defaultBaseUrl: 'https://example.com',
      defaultModel: 'test-model',
    }),
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(readFileSync(join(ROOT, 'lib/storage.js'), 'utf8'), context);
  return {
    getTabSummary: context.globalThis.getTabSummary,
    setTabSummary: context.globalThis.setTabSummary,
    clearTabSummary: context.globalThis.clearTabSummary,
  };
}

describe('tab summary cache', () => {
  /** @type {ReturnType<typeof loadStorage>} */
  let storage;

  beforeEach(() => {
    storage = loadStorage();
  });

  it('returns cached summary when pageUrl matches', async () => {
    const entry = {
      pageUrl: 'https://example.com/terms',
      doc: { sourceUrl: 'https://example.com/terms', text: 'Terms text' },
      summary: { plainSummary: 'Summary' },
      fromCache: false,
    };
    await storage.setTabSummary(42, entry);

    const cached = await storage.getTabSummary(42, 'https://example.com/terms');
    assert.equal(cached?.summary.plainSummary, 'Summary');
  });

  it('returns null when expectedUrl does not match cached pageUrl', async () => {
    await storage.setTabSummary(42, {
      pageUrl: 'https://example.com/terms-a',
      doc: { sourceUrl: 'https://example.com/terms-a', text: 'A' },
      summary: { plainSummary: 'Old' },
    });

    const cached = await storage.getTabSummary(42, 'https://example.com/terms-b');
    assert.equal(cached, null);
  });

  it('clearTabSummary removes the entry', async () => {
    await storage.setTabSummary(7, {
      pageUrl: 'https://example.com/privacy',
      doc: { sourceUrl: 'https://example.com/privacy', text: 'Privacy' },
      summary: { plainSummary: 'Privacy summary' },
    });

    await storage.clearTabSummary(7);
    const cached = await storage.getTabSummary(7);
    assert.equal(cached, null);
  });
});
