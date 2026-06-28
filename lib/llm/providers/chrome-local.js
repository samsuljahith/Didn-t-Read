/** @typedef {import('../../types.js').StructuredSummary} StructuredSummary */
/** @typedef {import('../../types.js').LlmSettings} LlmSettings */

/**
 * @param {string} _apiKey
 * @param {LlmSettings} settings
 * @param {{ system: string; user: string }} prompt
 * @param {AbortSignal} [signal]
 * @returns {Promise<StructuredSummary>}
 */
async function chromeLocalGenerateStructuredSummary(_apiKey, settings, prompt, signal) {
  const fullPrompt = {
    system: `${prompt.system}\n\nRespond with JSON only matching the required schema. No markdown fences.`,
    user: prompt.user,
  };

  const text = await promptLocalLlm(fullPrompt, signal);
  return parseSummaryJson(text);
}

/**
 * @param {string} _apiKey
 * @param {LlmSettings} _settings
 */
async function chromeLocalTestConnection(_apiKey, _settings) {
  await testLocalLlm();
}

const chromeLocalProvider = {
  id: 'chrome',
  origin: null,
  testConnection: chromeLocalTestConnection,
  generateStructuredSummary: chromeLocalGenerateStructuredSummary,
};
