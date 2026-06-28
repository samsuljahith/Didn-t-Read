/** @typedef {import('./types.js').ExtractedDoc} ExtractedDoc */
/** @typedef {import('./types.js').StructuredSummary} StructuredSummary */

const SHORT_DOC_WORDS = 3000;

/**
 * @param {ExtractedDoc} doc
 * @param {string} apiKey
 * @param {import('./types.js').LlmSettings} settings
 * @param {(progress: import('./types.js').JobProgress) => void} onProgress
 * @param {AbortSignal} [signal]
 * @returns {Promise<StructuredSummary>}
 */
async function analyze(doc, apiKey, settings, onProgress, signal) {
  onProgress({ phase: 'detecting', current: 1, total: 1 });

  if (doc.wordCount < SHORT_DOC_WORDS) {
    onProgress({ phase: 'summarizing', current: 0, total: 1 });
  }

  return summarizeDocument(doc, apiKey, settings, onProgress, signal);
}
