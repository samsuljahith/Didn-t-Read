/** @typedef {import('../types.js').StructuredSummary} StructuredSummary */
/** @typedef {import('../types.js').LlmSettings} LlmSettings */

const GEMINI_ORIGIN = 'https://generativelanguage.googleapis.com/*';

async function ensureGeminiPermission() {
  const has = await chrome.permissions.contains({ origins: [GEMINI_ORIGIN] });
  if (has) {
    return;
  }
  throw new Error(
    'Gemini network access is not allowed. Click Summarize again — Chrome should prompt you to allow access.',
  );
}

/**
 * @param {LlmSettings} settings
 */
function geminiBaseUrl(settings) {
  const base = (settings.providerUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(
    /\/$/,
    '',
  );
  if (base.includes('generativelanguage.googleapis.com')) {
    return base;
  }
  return 'https://generativelanguage.googleapis.com/v1beta';
}

/**
 * @param {string} apiKey
 * @param {LlmSettings} settings
 * @param {{ system: string; user: string }} prompt
 * @param {AbortSignal} [signal]
 * @returns {Promise<StructuredSummary>}
 */
async function geminiGenerateContent(apiKey, settings, prompt, signal) {
  await ensureGeminiPermission();

  const url =
    `${geminiBaseUrl(settings)}/models/${encodeURIComponent(settings.model)}:generateContent` +
    `?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: prompt.system }] },
      contents: [{ role: 'user', parts: [{ text: prompt.user }] }],
      generationConfig: {
        temperature: settings.temperature ?? 0.2,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
        responseSchema: GEMINI_RESPONSE_SCHEMA,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    if (response.status === 400 && body.includes('API key')) {
      throw new Error('Invalid API key. Check your key in Settings.');
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error('Invalid API key. Check your key in Settings.');
    }
    throw new Error(`Gemini request failed (${response.status}): ${body.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    const block = data.candidates?.[0]?.finishReason;
    throw new Error(block ? `Gemini returned no text (${block})` : 'Empty response from Gemini');
  }

  return parseSummaryJson(text);
}

/**
 * @param {string} apiKey
 * @param {LlmSettings} settings
 */
async function testGeminiConnection(apiKey, settings) {
  await ensureGeminiPermission();
  const url = `${geminiBaseUrl(settings)}/models?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      response.status === 400 || response.status === 403
        ? 'Invalid API key'
        : `Connection test failed (${response.status})`,
    );
  }
}

/** @param {string} apiKey @param {LlmSettings} settings */
async function testConnection(apiKey, settings) {
  return testGeminiConnection(apiKey, settings);
}
