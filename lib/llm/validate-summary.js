/** @typedef {import('../types.js').StructuredSummary} StructuredSummary */
/** @typedef {import('../types.js').RiskFactor} RiskFactor */

const RISK_LABELS = /** @type {const} */ (['low', 'medium', 'high']);
const FACTOR_CATEGORIES = /** @type {const} */ ([
  'data_collection',
  'third_party_sharing',
  'auto_renewal',
  'cancellation',
  'liability',
  'content_rights',
  'other',
]);
const FACTOR_SEVERITIES = /** @type {const} */ (['normal', 'caution', 'red_flag']);
const SEVERITY_ORDER = { red_flag: 0, caution: 1, normal: 2 };

/**
 * @param {number} score
 * @returns {'low' | 'medium' | 'high'}
 */
function riskLabelFromScore(score) {
  if (score >= 67) {
    return 'high';
  }
  if (score >= 34) {
    return 'medium';
  }
  return 'low';
}

/**
 * @param {string} raw
 * @returns {'low' | 'medium' | 'high'}
 */
function normalizeRiskLabel(raw) {
  const s = String(raw).toLowerCase().trim();
  if (s === 'high' || s === 'moderate' || s === 'medium') {
    return s === 'high' ? 'high' : 'medium';
  }
  if (s === 'low') {
    return 'low';
  }
  return 'medium';
}

/**
 * @param {unknown} raw
 * @returns {RiskFactor[]}
 */
function validateFactors(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }

  const factors = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const f = /** @type {Record<string, unknown>} */ (item);
    const clause = String(f.clause ?? '').trim();
    const why = String(f.why ?? '').trim();
    if (!clause || !why) {
      continue;
    }

    const category = String(f.category ?? 'other');
    const severity = String(f.severity ?? 'normal');

    factors.push({
      clause,
      category: FACTOR_CATEGORIES.includes(/** @type {typeof FACTOR_CATEGORIES[number]} */ (category))
        ? category
        : 'other',
      severity: FACTOR_SEVERITIES.includes(/** @type {typeof FACTOR_SEVERITIES[number]} */ (severity))
        ? severity
        : 'normal',
      why,
    });
  }

  return factors.sort(
    (a, b) =>
      (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9),
  );
}

/**
 * @param {unknown} data
 * @returns {StructuredSummary}
 */
function validateSummary(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid summary shape');
  }
  const obj = /** @type {Record<string, unknown>} */ (data);

  const riskyClauses = mergeArrays(obj.riskyClauses, obj.redFlags);
  const riskObj =
    typeof obj.riskScore === 'object' && obj.riskScore !== null
      ? /** @type {Record<string, unknown>} */ (obj.riskScore)
      : {};

  const rawScore = Number(riskObj.value ?? riskObj.score ?? obj.riskScore);
  const value = Number.isFinite(rawScore) ? Math.min(100, Math.max(0, Math.round(rawScore))) : 50;
  const factors = validateFactors(riskObj.factors);

  let label = riskObj.label
    ? normalizeRiskLabel(riskObj.label)
    : riskLabelFromScore(value);

  if (!RISK_LABELS.includes(label)) {
    label = riskLabelFromScore(value);
  }

  return {
    plainSummary: String(obj.plainSummary ?? obj.tldr ?? ''),
    riskScore: { value, label, factors },
    keyPoints: toStringArray(obj.keyPoints) ?? [],
    riskyClauses,
    dataCollection: mergeArrays(obj.dataCollection, obj.dataCollected),
    thirdPartySharing: toStringArray(obj.thirdPartySharing) ?? [],
    subscriptionTerms: toStringArray(obj.subscriptionTerms) ?? [],
    cancellationRefund: toStringArray(obj.cancellationRefund) ?? [],
    userObligations: mergeArrays(obj.userObligations, obj.obligations),
    legalClauses: mergeArrays(obj.legalClauses, obj.yourRights, obj.cookies),
    docType: obj.docType ? String(obj.docType) : undefined,
    confidence: /** @type {StructuredSummary['confidence']} */ (
      ['high', 'medium', 'low', 'partial'].includes(String(obj.confidence))
        ? obj.confidence
        : 'medium'
    ),
  };
}

/**
 * @param {string} raw
 * @returns {StructuredSummary}
 */
function parseSummaryJson(raw) {
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('LLM returned invalid JSON');
  }
  return validateSummary(parsed);
}

/** @param {unknown} val @returns {string[] | undefined} */
function toStringArray(val) {
  if (!Array.isArray(val) || !val.length) {
    return undefined;
  }
  return val.map(String);
}

/** @param {...unknown} sources */
function mergeArrays(...sources) {
  const out = [];
  for (const src of sources) {
    if (Array.isArray(src)) {
      out.push(...src.map(String));
    }
  }
  return out;
}
