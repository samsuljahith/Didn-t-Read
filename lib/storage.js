/** @typedef {import('./types.js').LlmSettings} LlmSettings */
/** @typedef {import('./types.js').TabSummaryCache} TabSummaryCache */

const STORAGE_KEYS = {
  apiKey: 'llmApiKey',
  settings: 'llmSettings',
};

const DEFAULT_SETTINGS = {
  providerUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  maxChunkTokens: 3000,
  temperature: 0.2,
};

/** @returns {Promise<string | null>} */
async function getApiKey() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.apiKey);
  return result[STORAGE_KEYS.apiKey] ?? null;
}

/** @param {string} key */
async function setApiKey(key) {
  await chrome.storage.local.set({ [STORAGE_KEYS.apiKey]: key });
}

async function clearApiKey() {
  await chrome.storage.local.remove(STORAGE_KEYS.apiKey);
}

/** @returns {Promise<LlmSettings>} */
async function getSettings() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.settings);
  return { ...DEFAULT_SETTINGS, ...result[STORAGE_KEYS.settings] };
}

/** @param {LlmSettings} settings */
async function setSettings(settings) {
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: settings });
}

/** @param {number} tabId @returns {Promise<TabSummaryCache | null>} */
async function getTabSummary(tabId) {
  const key = `summary:${tabId}`;
  const result = await chrome.storage.session.get(key);
  return result[key] ?? null;
}

/** @param {number} tabId @param {TabSummaryCache} data */
async function setTabSummary(tabId, data) {
  const key = `summary:${tabId}`;
  await chrome.storage.session.set({ [key]: data });
}
