/** @typedef {import('./types.js').ExtractedDoc} ExtractedDoc */
/** @typedef {import('./types.js').StructuredSummary} StructuredSummary */
/** @typedef {import('./types.js').LlmSettings} LlmSettings */

/** Single-call limit; longer docs are chunked in parallel */
const SAFE_INPUT_TOKENS = 45_000;

/**
 * @param {string} text
 */
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

/**
 * @param {string} text
 * @param {{ docType?: string; title?: string; settings: LlmSettings; onProgress: (p: import('./types.js').JobProgress) => void; signal?: AbortSignal }} ctx
 * @returns {Promise<StructuredSummary>}
 */
async function analyzeText(text, ctx) {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error('No API key configured. Open Settings to add one.');
  }

  const doc = {
    text,
    docType: ctx.docType,
    title: ctx.title,
    wordCount: text.trim() ? text.trim().split(/\s+/).length : 0,
  };

  const tokens = estimateTokens(text);

  if (tokens <= SAFE_INPUT_TOKENS) {
    ctx.onProgress({ phase: 'summarizing', current: 1, total: 1 });
    return callWithRetry(
      () => geminiGenerateContent(apiKey, ctx.settings, buildFullPrompt(doc), ctx.signal),
      ctx.signal,
      2,
    );
  }

  return summarizeDocument(doc, apiKey, ctx.settings, ctx.onProgress, ctx.signal);
}

/**
 * @param {ExtractedDoc} doc
 * @param {LlmSettings} settings
 * @param {(progress: import('./types.js').JobProgress) => void} onProgress
 * @param {AbortSignal} [signal]
 * @returns {Promise<StructuredSummary>}
 */
async function analyze(doc, settings, onProgress, signal) {
  onProgress({ phase: 'detecting', current: 1, total: 1 });
  return analyzeText(doc.text, {
    docType: doc.docType,
    title: doc.title,
    settings,
    onProgress,
    signal,
  });
}
