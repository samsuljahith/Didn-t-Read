/**
 * @param {string} url
 */
async function ensureFetchPermission(url) {
  let origin;
  try {
    origin = new URL(url).origin + '/*';
  } catch {
    throw new Error('Invalid policy URL');
  }

  if (url.startsWith('http:')) {
    throw new Error('Only HTTPS policy URLs are supported.');
  }

  const has = await chrome.permissions.contains({ origins: [origin] });
  if (has) {
    return;
  }

  const granted = await chrome.permissions.request({ origins: [origin] });
  if (!granted) {
    throw new Error(`Permission required to fetch policy from ${origin}`);
  }
}

/**
 * @param {string} url
 * @param {{ docType: string; confidence?: number; originalUrl?: string; linkLabel?: string }} meta
 * @returns {Promise<import('./types.js').ExtractedDoc>}
 */
async function extractFromUrl(url, meta) {
  await ensureFetchPermission(url);

  const res = await fetch(url, { credentials: 'omit', redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`Could not fetch policy page (HTTP ${res.status})`);
  }

  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('pdf')) {
    throw new Error('Policy is a PDF — open it in the browser to summarize.');
  }

  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const extracted = extractDocumentFromDoc(doc);

  if (extracted.wordCount < 100) {
    throw new Error('Fetched page had too little text — it may require login or block bots.');
  }

  return {
    docType: /** @type {import('./types.js').DocType} */ (meta.docType || 'unknown'),
    confidence: meta.confidence ?? 0.85,
    needsConfirmation: false,
    mode: 'document',
    isLegal: true,
    sourceUrl: url,
    originalUrl: meta.originalUrl,
    fetchedFromHub: true,
    linkLabel: meta.linkLabel,
    title: extracted.title,
    text: extracted.text,
    wordCount: extracted.wordCount,
    extractedAt: new Date().toISOString(),
  };
}
