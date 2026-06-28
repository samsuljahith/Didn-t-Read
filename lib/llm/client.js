/** @typedef {import('../types.js').StructuredSummary} StructuredSummary */
/** @typedef {import('../types.js').LlmSettings} LlmSettings */

/**
 * @param {string} providerUrl
 */
async function ensureHostPermission(providerUrl) {
  let origin;
  try {
    origin = new URL(providerUrl).origin + '/*';
  } catch {
    throw new Error('Invalid provider URL in settings');
  }

  const has = await chrome.permissions.contains({ origins: [origin] });
  if (has) {
    return;
  }

  const granted = await chrome.permissions.request({ origins: [origin] });
  if (!granted) {
    throw new Error(
      `Network access to ${new URL(providerUrl).origin} was denied. Grant permission to test and save your connection.`,
    );
  }
}

/**
 * @param {string} apiKey
 * @param {LlmSettings} settings
 * @param {{ system: string; user: string }} prompt
 * @returns {Promise<StructuredSummary>}
 */
async function completeJson(apiKey, settings, prompt) {
  await ensureHostPermission(settings.providerUrl);

  const url = settings.providerUrl.replace(/\/$/, '') + '/chat/completions';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: settings.temperature ?? 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    if (response.status === 401) {
      throw new Error('Invalid API key. Check your key in Settings.');
    }
    throw new Error(`LLM request failed (${response.status}): ${body.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Empty response from LLM');
  }

  return parseSummaryJson(content);
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

/**
 * @param {number} score
 */
function riskLabelFromScore(score) {
  if (score >= 67) {
    return 'High';
  }
  if (score >= 34) {
    return 'Moderate';
  }
  return 'Low';
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
  const rawScore = Number(
    typeof obj.riskScore === 'object' && obj.riskScore !== null
      ? /** @type {Record<string, unknown>} */ (obj.riskScore).score
      : obj.riskScore,
  );
  const score = Number.isFinite(rawScore) ? Math.min(100, Math.max(0, Math.round(rawScore))) : 50;
  const label =
    typeof obj.riskScore === 'object' &&
    obj.riskScore !== null &&
    /** @type {Record<string, unknown>} */ (obj.riskScore).label
      ? String(/** @type {Record<string, unknown>} */ (obj.riskScore).label)
      : riskLabelFromScore(score);

  return {
    plainSummary: String(obj.plainSummary ?? obj.tldr ?? ''),
    riskScore: { score, label },
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

/**
 * @param {string} apiKey
 * @param {LlmSettings} settings
 */
async function testConnection(apiKey, settings) {
  await validateApiKey(apiKey, settings);
}

/**
 * @param {string} apiKey
 * @param {LlmSettings} settings
 */
async function validateApiKey(apiKey, settings) {
  await ensureHostPermission(settings.providerUrl);
  const url = settings.providerUrl.replace(/\/$/, '') + '/models';
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) {
    throw new Error(response.status === 401 ? 'Invalid API key' : `Validation failed (${response.status})`);
  }
}
