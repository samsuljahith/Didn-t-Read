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
 * @param {LlmSettings} settings
 * @param {boolean} disableThinking
 */
function buildGenerationConfig(settings, disableThinking) {
  const config = {
    temperature: settings.temperature ?? 0.1,
    maxOutputTokens: 8192,
    responseMimeType: 'application/json',
    responseSchema: GEMINI_RESPONSE_SCHEMA,
  };
  if (disableThinking) {
    config.thinkingConfig = { thinkingBudget: 0 };
  }
  return config;
}

/**
 * @param {string} apiKey
 * @param {LlmSettings} settings
 * @param {{ system: string; user: string }} prompt
 * @param {AbortSignal} [signal]
 * @param {boolean} [disableThinking]
 */
async function postGemini(apiKey, settings, prompt, signal, disableThinking = true) {
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
      generationConfig: buildGenerationConfig(settings, disableThinking),
    }),
  });

  return { response, body: await response.text().catch(() => '') };
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

  let result = await postGemini(apiKey, settings, prompt, signal, true);
  if (!result.response.ok && result.body.includes('thinking') && result.response.status === 400) {
    result = await postGemini(apiKey, settings, prompt, signal, false);
  }

  const { response, body } = result;

  if (!response.ok) {
    if (response.status === 400 && body.includes('API key')) {
      throw new Error('Invalid API key. Check your key in Settings.');
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error('Invalid API key. Check your key in Settings.');
    }
    if (response.status === 404) {
      if (body.includes('no longer available') || body.includes('not found')) {
        throw new Error(
          'That AI model is no longer available. Open Settings and use gemini-2.5-flash.',
        );
      }
    }
    throw new Error(`Gemini request failed (${response.status}): ${body.slice(0, 200)}`);
  }

  const data = JSON.parse(body);
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text;
  const finishReason = candidate?.finishReason;

  if (!text) {
    throw new Error(finishReason ? `Gemini returned no text (${finishReason})` : 'Empty response from Gemini');
  }

  if (finishReason === 'MAX_TOKENS') {
    try {
      return parseSummaryJson(text);
    } catch {
      throw new Error('The analysis was cut short. Click Re-analyze to try again.');
    }
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
