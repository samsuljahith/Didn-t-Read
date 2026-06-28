/** @typedef {import('../../types.js').StructuredSummary} StructuredSummary */
/** @typedef {import('../../types.js').LlmSettings} LlmSettings */

const OPENAI_ORIGIN = 'https://api.openai.com/*';

async function ensureOpenAiPermission() {
  const has = await chrome.permissions.contains({ origins: [OPENAI_ORIGIN] });
  if (!has) {
    throw new Error(
      'AI provider network access is not allowed. Click Summarize again — Chrome should prompt you to allow access.',
    );
  }
}

/**
 * @param {LlmSettings} settings
 */
function openAiBaseUrl(settings) {
  const fallback = getProviderConfig('openai').defaultBaseUrl;
  return (settings.providerUrl || fallback).replace(/\/$/, '');
}

/**
 * @param {string} apiKey
 * @param {LlmSettings} settings
 * @param {{ system: string; user: string }} prompt
 * @param {AbortSignal} [signal]
 * @returns {Promise<StructuredSummary>}
 */
async function openAiGenerateStructuredSummary(apiKey, settings, prompt, signal) {
  await ensureOpenAiPermission();

  const url = `${openAiBaseUrl(settings)}/chat/completions`;
  const response = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: settings.temperature ?? 0.1,
      max_tokens: 8192,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'legal_analysis',
          strict: true,
          schema: RESPONSE_SCHEMA,
        },
      },
    }),
  });

  const body = await response.text().catch(() => '');
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Invalid API key. Check your key in Settings.');
    }
    throw new Error(`OpenAI request failed (${response.status}): ${body.slice(0, 200)}`);
  }

  const data = JSON.parse(body);
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('Empty response from OpenAI');
  }
  return parseSummaryJson(text);
}

/**
 * @param {string} apiKey
 * @param {LlmSettings} settings
 */
async function openAiTestConnection(apiKey, settings) {
  await ensureOpenAiPermission();
  const url = `${openAiBaseUrl(settings)}/models`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) {
    throw new Error(
      response.status === 401 || response.status === 403
        ? 'Invalid API key'
        : `Connection test failed (${response.status})`,
    );
  }
}

const openaiProvider = {
  id: 'openai',
  origin: OPENAI_ORIGIN,
  testConnection: openAiTestConnection,
  generateStructuredSummary: openAiGenerateStructuredSummary,
};
