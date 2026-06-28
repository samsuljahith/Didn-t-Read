/** @typedef {import('./types.js').StructuredSummary} StructuredSummary */
/** @typedef {import('./types.js').LlmSettings} LlmSettings */

const CACHE_PREFIX = 'analysis:';
const MAX_CACHE_ENTRIES = 50;

/**
 * @param {string} text
 */
async function hashText(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * @param {LlmSettings} settings
 */
function settingsFingerprint(settings) {
  return `${settings.providerUrl}|${settings.model}|${settings.maxChunkTokens}|${settings.temperature}`;
}

/**
 * @param {string} textHash
 * @param {LlmSettings} settings
 * @returns {Promise<StructuredSummary | null>}
 */
async function getAnalysisCache(textHash, settings) {
  const key = CACHE_PREFIX + textHash;
  const result = await chrome.storage.local.get(key);
  const entry = result[key];
  if (!entry?.summary) {
    return null;
  }
  if (entry.settingsFingerprint !== settingsFingerprint(settings)) {
    return null;
  }
  return entry.summary;
}

/**
 * @param {string} textHash
 * @param {LlmSettings} settings
 * @param {StructuredSummary} summary
 */
async function setAnalysisCache(textHash, settings, summary) {
  const key = CACHE_PREFIX + textHash;
  await chrome.storage.local.set({
    [key]: {
      summary,
      settingsFingerprint: settingsFingerprint(settings),
      cachedAt: new Date().toISOString(),
    },
  });
  await pruneAnalysisCache();
}

async function pruneAnalysisCache() {
  const all = await chrome.storage.local.get(null);
  const entries = Object.entries(all)
    .filter(([key]) => key.startsWith(CACHE_PREFIX))
    .map(([key, value]) => ({
      key,
      cachedAt: value?.cachedAt ?? '',
    }))
    .sort((a, b) => b.cachedAt.localeCompare(a.cachedAt));

  if (entries.length <= MAX_CACHE_ENTRIES) {
    return;
  }

  const toRemove = entries.slice(MAX_CACHE_ENTRIES).map((e) => e.key);
  await chrome.storage.local.remove(toRemove);
}

/**
 * @param {string} textHash
 * @param {'hit' | 'miss' | 'bypass'} kind
 */
function logCacheEvent(textHash, kind) {
  const short = textHash.slice(0, 12);
  if (kind === 'hit') {
    console.log(`[Didn't Read] analysis cache HIT (${short}…)`);
  } else if (kind === 'miss') {
    console.log(`[Didn't Read] analysis cache MISS (${short}…)`);
  } else {
    console.log(`[Didn't Read] analysis cache bypass — re-analyze (${short}…)`);
  }
}
