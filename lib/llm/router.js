/** @typedef {import('../types.js').StructuredSummary} StructuredSummary */
/** @typedef {import('../types.js').LlmSettings} LlmSettings */
/** @typedef {import('../types.js').ProviderId} ProviderId */

/**
 * @param {ProviderId | string | undefined} id
 */
function getProvider(id) {
  const providerId = /** @type {ProviderId} */ (id || 'gemini');
  switch (providerId) {
    case 'openai':
      return openaiProvider;
    case 'anthropic':
      return anthropicProvider;
    case 'grok':
      return grokProvider;
    default:
      return geminiProvider;
  }
}

/**
 * @param {string} apiKey
 * @param {LlmSettings} settings
 * @param {{ system: string; user: string }} prompt
 * @param {AbortSignal} [signal]
 * @returns {Promise<StructuredSummary>}
 */
async function generateStructuredSummary(apiKey, settings, prompt, signal) {
  const adapter = getProvider(settings.providerId);
  return adapter.generateStructuredSummary(apiKey, settings, prompt, signal);
}

/**
 * @param {string} apiKey
 * @param {LlmSettings} settings
 */
async function testConnection(apiKey, settings) {
  const adapter = getProvider(settings.providerId);
  return adapter.testConnection(apiKey, settings);
}

/** @deprecated Use generateStructuredSummary */
async function geminiGenerateContent(apiKey, settings, prompt, signal) {
  return generateStructuredSummary(apiKey, settings, prompt, signal);
}
