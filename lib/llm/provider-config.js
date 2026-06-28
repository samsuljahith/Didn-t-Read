/** @typedef {'gemini' | 'openai' | 'anthropic' | 'grok'} ProviderId */

const PROVIDERS = {
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    origin: 'https://generativelanguage.googleapis.com/*',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.5-flash',
    keyUrl: 'https://aistudio.google.com/apikey',
  },
  openai: {
    id: 'openai',
    label: 'ChatGPT (OpenAI)',
    origin: 'https://api.openai.com/*',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  anthropic: {
    id: 'anthropic',
    label: 'Claude (Anthropic)',
    origin: 'https://api.anthropic.com/*',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-sonnet-4-20250514',
    keyUrl: 'https://console.anthropic.com/settings/keys',
  },
  grok: {
    id: 'grok',
    label: 'Grok (xAI)',
    origin: 'https://api.x.ai/*',
    defaultBaseUrl: 'https://api.x.ai/v1',
    defaultModel: 'grok-2-latest',
    keyUrl: 'https://console.x.ai/',
  },
};

/**
 * @param {string} id
 */
function getProviderConfig(id) {
  return PROVIDERS[/** @type {ProviderId} */ (id)] ?? PROVIDERS.gemini;
}
