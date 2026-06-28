/** @typedef {import('../../types.js').StructuredSummary} StructuredSummary */
/** @typedef {import('../../types.js').LlmSettings} LlmSettings */

const ANTHROPIC_ORIGIN = 'https://api.anthropic.com/*';

async function ensureAnthropicPermission() {
  const has = await chrome.permissions.contains({ origins: [ANTHROPIC_ORIGIN] });
  if (!has) {
    throw new Error(
      'AI provider network access is not allowed. Click Summarize again — Chrome should prompt you to allow access.',
    );
  }
}

/**
 * @param {LlmSettings} settings
 */
function anthropicBaseUrl(settings) {
  const fallback = getProviderConfig('anthropic').defaultBaseUrl;
  return (settings.providerUrl || fallback).replace(/\/$/, '');
}

/**
 * @param {string} apiKey
 * @param {LlmSettings} settings
 * @param {{ system: string; user: string }} prompt
 * @param {AbortSignal} [signal]
 * @returns {Promise<StructuredSummary>}
 */
async function anthropicGenerateStructuredSummary(apiKey, settings, prompt, signal) {
  await ensureAnthropicPermission();

  const url = `${anthropicBaseUrl(settings)}/messages`;
  const response = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: settings.model,
      max_tokens: 8192,
      temperature: settings.temperature ?? 0.1,
      system: `${prompt.system}\n\nRespond with JSON only matching the required schema. No markdown fences.`,
      messages: [{ role: 'user', content: prompt.user }],
    }),
  });

  const body = await response.text().catch(() => '');
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Invalid API key. Check your key in Settings.');
    }
    throw new Error(`Anthropic request failed (${response.status}): ${body.slice(0, 200)}`);
  }

  const data = JSON.parse(body);
  const text = data.content?.find((c) => c.type === 'text')?.text;
  if (!text) {
    throw new Error('Empty response from Anthropic');
  }
  return parseSummaryJson(text);
}

/**
 * @param {string} apiKey
 * @param {LlmSettings} settings
 */
async function anthropicTestConnection(apiKey, settings) {
  await ensureAnthropicPermission();
  const url = `${anthropicBaseUrl(settings)}/messages`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: settings.model,
      max_tokens: 16,
      messages: [{ role: 'user', content: 'ping' }],
    }),
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error('Invalid API key');
  }
  if (!response.ok && response.status !== 400) {
    throw new Error(`Connection test failed (${response.status})`);
  }
}

const anthropicProvider = {
  id: 'anthropic',
  origin: ANTHROPIC_ORIGIN,
  testConnection: anthropicTestConnection,
  generateStructuredSummary: anthropicGenerateStructuredSummary,
};
