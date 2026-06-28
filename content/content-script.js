if (!globalThis.__didntReadInjected) {
  globalThis.__didntReadInjected = true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'DETECT_AND_EXTRACT') {
      detectAndExtract()
        .then(sendResponse)
        .catch((err) => sendResponse({ error: err.message ?? 'Extraction failed' }));
      return true;
    }

    if (message.type === 'EXTRACT_POLICY_URL') {
      extractPolicyFromUrl(message.url, message.meta)
        .then(sendResponse)
        .catch((err) => sendResponse({ error: err.message ?? 'Policy fetch failed' }));
      return true;
    }

    return false;
  });
}

/**
 * @param {string} url
 * @param {Record<string, unknown>} meta
 */
async function extractPolicyFromUrl(url, meta) {
  if (url.startsWith('http:')) {
    throw new Error('Only HTTPS policy URLs are supported.');
  }
  if (/\.pdf(\?|$)/i.test(url)) {
    throw new Error('Policy is a PDF — open it in the browser to summarize.');
  }

  const policyOrigin = new URL(url, location.href).origin;
  if (policyOrigin !== location.origin) {
    return { crossOrigin: true };
  }

  const res = await fetch(url, { credentials: 'same-origin', redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`Could not fetch policy page (HTTP ${res.status})`);
  }

  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('pdf')) {
    throw new Error('Policy is a PDF — open it in the browser to summarize.');
  }

  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const extracted = await extractDocumentFromDocAsync(doc);

  if (extracted.wordCount < 100) {
    throw new Error('Fetched page had too little text — it may require login.');
  }

  return {
    docType: meta.docType,
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

async function detectAndExtract() {
  const scoring = scoreLegalDoc();
  const extracted = await extractDocumentFromDocAsync(document);

  const isHub =
    scoring.mode === 'hub' ||
    (scoring.wordCount < 800 &&
      scoring.linkedPolicies.length > 0 &&
      scoring.hubScore > scoring.documentScore);

  if (isHub && scoring.linkedPolicies.length > 0) {
    const preferredType = scoring.type !== 'unknown' ? scoring.type : scoring.linkedPolicies[0].type;
    const best = pickBestPolicyLink(scoring.linkedPolicies, preferredType);
    if (!best) {
      throw new Error('Found policy links but could not select one to fetch.');
    }

    return {
      needsFetch: true,
      policyUrl: best.href,
      docType: best.type,
      originalUrl: location.href,
      confidence: Math.max(scoring.confidence, 0.7),
      needsConfirmation: false,
      mode: 'hub',
      linkLabel: best.label,
    };
  }

  if (!extracted.text.trim()) {
    throw new Error('No readable text found on this page.');
  }

  if (!scoring.isLegal) {
    return {
      isLegal: false,
      blockReason: scoring.blockReason ?? 'not_a_legal_page',
      docType: scoring.type,
      confidence: scoring.confidence,
      mode: scoring.mode,
      error: 'This does not appear to be a legal agreement page.',
    };
  }

  return {
    needsFetch: false,
    docType: scoring.type,
    confidence: scoring.confidence,
    needsConfirmation: scoring.needsConfirmation,
    mode: scoring.mode,
    isLegal: scoring.isLegal,
    sourceUrl: location.href,
    title: extracted.title || scoring.label,
    text: extracted.text,
    wordCount: extracted.wordCount,
    extractedAt: new Date().toISOString(),
  };
}
