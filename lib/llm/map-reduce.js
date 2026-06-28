/** @typedef {import('../types.js').ExtractedDoc} ExtractedDoc */
/** @typedef {import('../types.js').StructuredSummary} StructuredSummary */
/** @typedef {import('../types.js').LlmSettings} LlmSettings */

const SHORT_DOC_WORDS = 3000;
const MAP_CONCURRENCY = 3;
const REDUCE_BATCH_SIZE = 5;

/**
 * @param {ExtractedDoc} doc
 * @param {string} apiKey
 * @param {LlmSettings} settings
 * @param {(progress: import('../types.js').JobProgress) => void} onProgress
 * @param {AbortSignal} [signal]
 * @returns {Promise<StructuredSummary>}
 */
async function summarizeDocument(doc, apiKey, settings, onProgress, signal) {
  const maxChunkTokens = settings.maxChunkTokens ?? 3000;

  if (doc.wordCount < SHORT_DOC_WORDS) {
    onProgress({ phase: 'summarizing', current: 1, total: 1 });
    return callWithRetry(
      () => completeJson(apiKey, settings, buildFullPrompt(doc)),
      signal,
    );
  }

  const chunks = chunkText(doc.text, maxChunkTokens);
  onProgress({ phase: 'chunking', current: 0, total: chunks.length });

  const partials = await mapChunks(doc, chunks, apiKey, settings, onProgress, signal);
  onProgress({ phase: 'reducing', current: 1, total: 1 });
  return reducePartials(doc, partials, apiKey, settings, maxChunkTokens, signal);
}

/**
 * @param {ExtractedDoc} doc
 * @param {{ index: number; total: number; text: string }[]} chunks
 * @param {string} apiKey
 * @param {LlmSettings} settings
 * @param {(progress: import('../types.js').JobProgress) => void} onProgress
 * @param {AbortSignal} [signal]
 */
async function mapChunks(doc, chunks, apiKey, settings, onProgress, signal) {
  const results = /** @type {(StructuredSummary | null)[]} */ (new Array(chunks.length).fill(null));
  let completed = 0;

  const runOne = async (chunk) => {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    try {
      const summary = await callWithRetry(
        () => completeJson(apiKey, settings, buildChunkPrompt(doc, chunk)),
        signal,
      );
      results[chunk.index] = summary;
    } catch {
      results[chunk.index] = {
        plainSummary: '',
        riskScore: { score: 50, label: 'Moderate' },
        keyPoints: [`[Summarization failed for chunk ${chunk.index + 1}]`],
        riskyClauses: [],
        dataCollection: [],
        thirdPartySharing: [],
        subscriptionTerms: [],
        cancellationRefund: [],
        userObligations: [],
        legalClauses: [],
        confidence: 'partial',
      };
    }
    completed++;
    onProgress({ phase: 'chunking', current: completed, total: chunks.length });
  };

  const queue = [...chunks];
  const workers = Array.from({ length: Math.min(MAP_CONCURRENCY, queue.length) }, async () => {
    while (queue.length) {
      const chunk = queue.shift();
      if (chunk) {
        await runOne(chunk);
      }
    }
  });
  await Promise.all(workers);

  return results.filter(Boolean);
}

/**
 * @param {ExtractedDoc} doc
 * @param {StructuredSummary[]} partials
 * @param {string} apiKey
 * @param {LlmSettings} settings
 * @param {number} maxChunkTokens
 * @param {AbortSignal} [signal]
 */
async function reducePartials(doc, partials, apiKey, settings, maxChunkTokens, signal) {
  if (partials.length === 1) {
    return { ...partials[0], confidence: partials[0].confidence === 'partial' ? 'medium' : partials[0].confidence };
  }

  if (partialsFitInContext(partials, maxChunkTokens)) {
    return callWithRetry(
      () => completeJson(apiKey, settings, buildMergePrompt(doc, partials)),
      signal,
    );
  }

  const batches = [];
  for (let i = 0; i < partials.length; i += REDUCE_BATCH_SIZE) {
    batches.push(partials.slice(i, i + REDUCE_BATCH_SIZE));
  }

  const reduced = [];
  for (const batch of batches) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    const merged = await callWithRetry(
      () => completeJson(apiKey, settings, buildMergePrompt(doc, batch)),
      signal,
    );
    reduced.push(merged);
  }

  return reducePartials(doc, reduced, apiKey, settings, maxChunkTokens, signal);
}

/**
 * @template T
 * @param {() => Promise<T>} fn
 * @param {AbortSignal} [signal]
 * @param {number} [retries]
 */
async function callWithRetry(fn, signal, retries = 1) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = String(err?.message ?? err);
      if (msg.includes('invalid JSON') && attempt < retries) {
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}
