/** @typedef {import('./types.js').LlmSettings} LlmSettings */
/** @typedef {import('./types.js').TabSummaryCache} TabSummaryCache */

(function () {
  const LLM_STORAGE_KEYS = {
    apiKey: 'llmApiKey',
    settings: 'llmSettings',
  };

  const LLM_DEFAULT_SETTINGS = {
    providerUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-2.0-flash',
    maxChunkTokens: 3000,
    temperature: 0.2,
  };

  /** @returns {Promise<string | null>} */
  globalThis.getApiKey = async function getApiKey() {
    const result = await chrome.storage.local.get(LLM_STORAGE_KEYS.apiKey);
    return result[LLM_STORAGE_KEYS.apiKey] ?? null;
  };

  /** @param {string} key */
  globalThis.setApiKey = async function setApiKey(key) {
    await chrome.storage.local.set({ [LLM_STORAGE_KEYS.apiKey]: key });
  };

  globalThis.clearApiKey = async function clearApiKey() {
    await chrome.storage.local.remove(LLM_STORAGE_KEYS.apiKey);
  };

  /** @returns {Promise<LlmSettings>} */
  globalThis.getSettings = async function getSettings() {
    const result = await chrome.storage.local.get(LLM_STORAGE_KEYS.settings);
    return { ...LLM_DEFAULT_SETTINGS, ...result[LLM_STORAGE_KEYS.settings] };
  };

  /** @param {LlmSettings} settings */
  globalThis.setSettings = async function setSettings(settings) {
    await chrome.storage.local.set({ [LLM_STORAGE_KEYS.settings]: settings });
  };

  /** @param {number} tabId @returns {Promise<TabSummaryCache | null>} */
  globalThis.getTabSummary = async function getTabSummary(tabId) {
    const key = `summary:${tabId}`;
    const result = await chrome.storage.session.get(key);
    return result[key] ?? null;
  };

  /** @param {number} tabId @param {TabSummaryCache} data */
  globalThis.setTabSummary = async function setTabSummary(tabId, data) {
    const key = `summary:${tabId}`;
    await chrome.storage.session.set({ [key]: data });
  };
})();
