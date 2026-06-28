/** @typedef {import('../lib/types.js').DocType} DocType */

const LEGAL_PATTERNS = [
  { docType: 'privacy', re: /privacy|data protection|personal (data|information)|gdpr/, weight: 0.35 },
  { docType: 'terms', re: /terms|conditions|terms of (service|use)|user agreement/, weight: 0.35 },
  { docType: 'cookies', re: /cookie(s)? (policy|notice)|cookie preferences/, weight: 0.35 },
];

const URL_HINTS = [
  { docType: 'privacy', re: /\/(privacy|data-protection|legal\/privacy)/i },
  { docType: 'terms', re: /\/(terms|tos|conditions|legal\/terms)/i },
  { docType: 'cookies', re: /\/(cookie|cookies)/i },
];

const TYPE_LABELS = {
  privacy: 'Privacy Policy',
  terms: 'Terms of Service',
  cookies: 'Cookie Policy',
  unknown: 'Unknown document',
};

const MIN_DOCUMENT_WORDS = 800;

/**
 * @param {Document} [doc]
 */
function scoreLegalDoc(doc = document) {
  const pageUrl = doc.defaultView?.location?.href ?? location.href;
  const pageOrigin = new URL(pageUrl).origin;

  const extracted = extractDocumentFromDoc(doc);
  const legalDensity = measureLegalDensity(extracted.text);
  const typeScores = computeTypeScores(doc);
  const type = pickBestType(typeScores);
  const linkedPolicies = findPolicyLinks(doc, pageUrl);

  const headingMatch = headerMatchesType(doc, type);
  const urlMatch = urlMatchesType(doc, type);

  let documentScore = 0;
  if (extracted.wordCount >= MIN_DOCUMENT_WORDS) {
    documentScore += 0.4;
  } else if (extracted.wordCount >= 300) {
    documentScore += 0.2;
  }
  if (legalDensity >= 2) {
    documentScore += 0.35;
  } else if (legalDensity >= 1) {
    documentScore += 0.15;
  }
  if (headingMatch) {
    documentScore += 0.25;
  }
  if (urlMatch) {
    documentScore += 0.2;
  }

  let hubScore = 0;
  if (linkedPolicies.length >= 1) {
    hubScore += 0.3;
  }
  if (linkedPolicies.length >= 2) {
    hubScore += 0.15;
  }
  if (extracted.wordCount < MIN_DOCUMENT_WORDS) {
    hubScore += 0.35;
  }
  if (legalDensity < 1.5) {
    hubScore += 0.2;
  }

  let mode = 'unknown';
  if (documentScore >= hubScore && extracted.wordCount >= 300 && documentScore >= 0.45) {
    mode = 'document';
  } else if (hubScore > documentScore && linkedPolicies.length >= 1) {
    mode = 'hub';
  } else if (documentScore >= 0.5) {
    mode = 'document';
  }

  const confidence = Math.min(Math.max(documentScore, hubScore, typeScores[type] ?? 0), 0.98);
  const needsConfirmation = mode === 'document' && confidence < 0.55;

  const isHubWithPolicy = mode === 'hub' && linkedPolicies.length >= 1;
  const isConfidentDoc = mode !== 'unknown' && confidence >= 0.55;
  const isLegal = isConfidentDoc || isHubWithPolicy;

  let blockReason = null;
  if (!isLegal) {
    blockReason = mode === 'unknown' ? 'not_a_legal_page' : 'low_confidence';
  }

  return {
    isLegal,
    blockReason,
    confidence: confidence || 0.2,
    type,
    mode,
    needsConfirmation,
    needsConfirmation,
    label: TYPE_LABELS[type] ?? TYPE_LABELS.unknown,
    linkedPolicies,
    documentScore,
    hubScore,
    wordCount: extracted.wordCount,
    legalDensity,
    pageOrigin,
  };
}

/** @deprecated Use scoreLegalDoc */
function detectLegalDoc() {
  const s = scoreLegalDoc();
  return {
    docType: s.type,
    confidence: s.confidence,
    label: s.label,
    needsConfirmation: s.needsConfirmation,
  };
}

/**
 * @param {Document} doc
 */
function computeTypeScores(doc) {
  const scores = { privacy: 0, terms: 0, cookies: 0, unknown: 0.1 };

  const path = (doc.defaultView?.location?.pathname ?? location.pathname).toLowerCase();
  const title = (doc.title ?? '').toLowerCase();
  const h1 = (doc.querySelector('h1')?.textContent ?? '').toLowerCase();
  const ogTitle = (
    doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ?? ''
  ).toLowerCase();
  const headerText = [title, h1, ogTitle, extractJsonLdName(doc)].filter(Boolean).join(' ');

  for (const { docType, re } of URL_HINTS) {
    if (re.test(path)) {
      scores[docType] += 0.3;
    }
  }

  for (const { docType, re, weight } of LEGAL_PATTERNS) {
    if (re.test(headerText)) {
      scores[docType] += weight;
    }
  }

  const linkTexts = [...doc.querySelectorAll('a')]
    .slice(0, 200)
    .map((a) => (a.textContent ?? '').toLowerCase());
  for (const { docType, re, weight } of LEGAL_PATTERNS) {
    if (linkTexts.some((t) => re.test(t))) {
      scores[docType] += weight * 0.25;
    }
  }

  const bodySample = (doc.body?.innerText ?? '').slice(0, 8000).toLowerCase();
  const keywordHits = LEGAL_DENSITY_KEYWORDS.filter((kw) => bodySample.includes(kw)).length;
  if (keywordHits >= 2) {
    for (const key of ['privacy', 'terms', 'cookies']) {
      scores[key] += 0.05 * keywordHits;
    }
  }

  return scores;
}

/**
 * @param {Record<string, number>} scores
 * @returns {DocType}
 */
function pickBestType(scores) {
  let bestType = 'unknown';
  let bestScore = scores.unknown;
  for (const [type, score] of Object.entries(scores)) {
    if (type !== 'unknown' && score > bestScore) {
      bestScore = score;
      bestType = /** @type {DocType} */ (type);
    }
  }
  return bestType;
}

/**
 * @param {Document} doc
 * @param {DocType} type
 */
function headerMatchesType(doc, type) {
  if (type === 'unknown') {
    return false;
  }
  const headerText = [
    doc.title,
    doc.querySelector('h1')?.textContent,
    doc.querySelector('meta[property="og:title"]')?.getAttribute('content'),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const pattern = LEGAL_PATTERNS.find((p) => p.docType === type);
  return pattern ? pattern.re.test(headerText) : false;
}

/**
 * @param {Document} doc
 * @param {DocType} type
 */
function urlMatchesType(doc, type) {
  if (type === 'unknown') {
    return false;
  }
  const path = (doc.defaultView?.location?.pathname ?? location.pathname).toLowerCase();
  const hint = URL_HINTS.find((h) => h.docType === type);
  return hint ? hint.re.test(path) : false;
}

/**
 * @param {Document} doc
 * @param {string} pageUrl
 */
function findPolicyLinks(doc, pageUrl) {
  /** @type {{ type: DocType; href: string; label: string; inFooter: boolean; sameOrigin: boolean }[]} */
  const links = [];
  const pageOrigin = new URL(pageUrl).origin;

  for (const a of doc.querySelectorAll('a[href]')) {
    const raw = a.getAttribute('href');
    if (!raw || raw.startsWith('#') || raw.startsWith('javascript:') || raw.startsWith('mailto:')) {
      continue;
    }

    let href;
    try {
      href = new URL(raw, pageUrl).href;
    } catch {
      continue;
    }

    if (!href.startsWith('http') || /\.pdf(\?|$)/i.test(href)) {
      continue;
    }

    const text = (a.textContent ?? '').trim().toLowerCase();
    const hrefLower = href.toLowerCase();

    for (const { docType, re } of LEGAL_PATTERNS) {
      if (re.test(text) || re.test(hrefLower)) {
        links.push({
          type: /** @type {DocType} */ (docType),
          href,
          label: (a.textContent ?? '').trim() || href,
          inFooter: Boolean(a.closest('footer, [role="contentinfo"]')),
          sameOrigin: new URL(href).origin === pageOrigin,
        });
        break;
      }
    }
  }

  const seen = new Set();
  return links.filter((l) => {
    if (seen.has(l.href)) {
      return false;
    }
    seen.add(l.href);
    return true;
  });
}

/**
 * @param {{ type: DocType; href: string; label: string; inFooter: boolean; sameOrigin: boolean }[]} links
 * @param {DocType} preferredType
 */
function pickBestPolicyLink(links, preferredType) {
  return [...links].sort((a, b) => {
    if (a.type === preferredType && b.type !== preferredType) {
      return -1;
    }
    if (b.type === preferredType && a.type !== preferredType) {
      return 1;
    }
    if (a.sameOrigin && !b.sameOrigin) {
      return -1;
    }
    if (b.sameOrigin && !a.sameOrigin) {
      return 1;
    }
    if (a.inFooter && !b.inFooter) {
      return -1;
    }
    if (b.inFooter && !a.inFooter) {
      return 1;
    }
    return b.label.length - a.label.length;
  })[0];
}

/**
 * @param {Document} [doc]
 */
function extractJsonLdName(doc = document) {
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(script.textContent ?? '');
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        const name = (item.name ?? item.headline ?? '').toLowerCase();
        if (name) {
          return name;
        }
      }
    } catch {
      // ignore invalid JSON-LD
    }
  }
  return '';
}
