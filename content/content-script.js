if (!globalThis.__didntReadInjected) {
  globalThis.__didntReadInjected = true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'DETECT_AND_EXTRACT') {
      detectAndExtract()
        .then(sendResponse)
        .catch((err) => sendResponse({ error: err.message ?? 'Extraction failed' }));
      return true;
    }
    return false;
  });
}

async function detectAndExtract() {
  const scoring = scoreLegalDoc();
  const extracted = extractDocumentFromDoc(document);

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
