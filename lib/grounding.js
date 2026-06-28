/** @typedef {import('./types.js').StructuredSummary} StructuredSummary */
/** @typedef {import('./types.js').PriorityConcerns} PriorityConcerns */

const PRIORITY_KEYS = [
  'sellsOrSharesData',
  'dataForAdvertising',
  'thirdPartySharing',
  'hasRefundPolicy',
  'hasCancellationPolicy',
  'paymentsRefundable',
];

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'that',
  'with',
  'this',
  'from',
  'your',
  'are',
  'not',
  'may',
  'will',
  'our',
  'you',
  'any',
  'all',
  'can',
  'has',
  'have',
  'been',
  'its',
  'such',
]);

/**
 * @param {string} text
 */
function normalizeForMatch(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string} haystackNorm
 * @param {string} phrase
 */
function phraseIsGrounded(haystackNorm, phrase) {
  const p = normalizeForMatch(phrase);
  if (p.length < 8) {
    return false;
  }

  if (haystackNorm.includes(p)) {
    return true;
  }

  const words = p.split(' ').filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  if (words.length < 2) {
    return false;
  }

  let hits = 0;
  for (const w of words) {
    if (haystackNorm.includes(w)) {
      hits++;
    }
  }

  return hits / words.length >= 0.65;
}

/**
 * @param {PriorityConcerns} priorities
 * @param {string} haystackNorm
 */
function groundPriorities(priorities, haystackNorm) {
  /** @type {PriorityConcerns} */
  const out = { ...priorities };

  for (const key of PRIORITY_KEYS) {
    const item = priorities[key];
    if (!item || item.status === 'unclear' || !item.answer) {
      continue;
    }

    if (!phraseIsGrounded(haystackNorm, item.answer)) {
      out[key] = {
        status: 'unclear',
        answer: item.answer
          ? `${item.answer} (Could not verify this against the page text.)`
          : '',
      };
    }
  }

  return out;
}

/**
 * Downgrade AI claims that lack support in the source document.
 * @param {StructuredSummary} summary
 * @param {string} sourceText
 * @returns {StructuredSummary}
 */
function groundSummary(summary, sourceText) {
  if (!sourceText?.trim()) {
    return summary;
  }

  const haystackNorm = normalizeForMatch(sourceText);
  const priorities = groundPriorities(summary.priorities, haystackNorm);

  const factors = (summary.riskScore?.factors ?? []).filter((f) =>
    phraseIsGrounded(haystackNorm, f.clause),
  );

  return {
    ...summary,
    priorities,
    riskScore: {
      ...summary.riskScore,
      factors,
    },
  };
}
