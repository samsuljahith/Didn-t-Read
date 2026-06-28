const MAX_CHARS = 500_000;
const MIN_CANDIDATE_LEN = 140;
const LARGE_DOC_CHAR_THRESHOLD = 80_000;
const CANDIDATE_YIELD_EVERY = 40;
const WALKER_YIELD_EVERY = 800;

const POSITIVE_CLASS_RE = /article|content|post|entry|legal|policy|main-text|body-content|wysiwyg/i;
const NEGATIVE_CLASS_RE =
  /nav|footer|sidebar|menu|comment|advert|banner|cookie|newsletter|social|related|promo|header|breadcrumb|widget/i;

const STRIP_SELECTORS = [
  'script',
  'style',
  'nav',
  'footer',
  'header',
  'aside',
  'noscript',
  'iframe',
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
  '.cookie-banner',
  '.cookie-consent',
  '#onetrust-banner-sdk',
  '.ad',
  '.ads',
  '.advertisement',
  '[data-ad]',
  '.social-share',
  '.newsletter',
  '.related-posts',
  '[aria-hidden="true"]',
].join(',');

const LEGAL_DENSITY_KEYWORDS = [
  'personal data',
  'we collect',
  'governing law',
  'third party',
  'opt out',
  'data controller',
  'you agree',
  'limitation of liability',
  'arbitration',
  'retention',
  'lawful basis',
  'strictly necessary',
  'consent',
];

const SEMANTIC_SELECTORS = [
  'main',
  'article',
  '[role="main"]',
  '.legal-content',
  '.policy-content',
  '.entry-content',
  '.post-content',
  '#content',
];

/**
 * @param {string} str
 */
function classIdScore(str) {
  let score = 0;
  if (POSITIVE_CLASS_RE.test(str)) {
    score += 200;
  }
  if (NEGATIVE_CLASS_RE.test(str)) {
    score -= 400;
  }
  return score;
}

/**
 * @param {Element} el
 */
function scoreNode(el) {
  const text = el.textContent ?? '';
  const len = text.length;
  if (len < MIN_CANDIDATE_LEN) {
    return -Infinity;
  }

  const links = el.querySelectorAll('a');
  let linkLen = 0;
  links.forEach((a) => {
    linkLen += (a.textContent ?? '').length;
  });
  const linkDensity = linkLen / Math.max(len, 1);

  let score = len;
  score -= linkDensity * len * 1.5;
  score += classIdScore(`${el.className?.toString?.() ?? ''} ${el.id ?? ''}`);
  score += el.querySelectorAll('p').length * 50;
  score += el.querySelectorAll('h2, h3').length * 30;
  return score;
}

/**
 * @param {Document} doc
 * @returns {Element}
 */
function findReadableRoot(doc) {
  for (const sel of SEMANTIC_SELECTORS) {
    const el = doc.querySelector(sel);
    if (el && scoreNode(el) > 0) {
      return el;
    }
  }

  const body = doc.body;
  if (!body) {
    return doc.documentElement;
  }

  let best = null;
  let bestScore = -Infinity;
  const candidates = body.querySelectorAll('article, main, section, div');
  for (const el of candidates) {
    const s = scoreNode(el);
    if (s > bestScore) {
      bestScore = s;
      best = el;
    }
  }

  return best ?? body;
}

/**
 * @param {Element} root
 */
function extractWithHeadings(root) {
  const clone = root.cloneNode(true);
  clone.querySelectorAll(STRIP_SELECTORS).forEach((el) => el.remove());

  const ownerDoc = root.ownerDocument ?? root;
  const parts = [];
  const walker = ownerDoc.createTreeWalker(clone, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);

  let node = walker.currentNode;
  while (node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName;
      if (/^H[1-6]$/.test(tag)) {
        const level = Number(tag[1]);
        const heading = (node.textContent ?? '').trim();
        if (heading) {
          parts.push(`\n${'#'.repeat(level)} ${heading}\n`);
        }
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      const parent = node.parentElement;
      if (parent && /^H[1-6]$/.test(parent.tagName)) {
        // heading handled above
      } else {
        const t = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
        if (t) {
          parts.push(t);
        }
      }
    }
    node = walker.nextNode();
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * @param {string} text
 */
function countWords(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/**
 * @param {string} text
 */
function measureLegalDensity(text) {
  const sample = text.slice(0, 20000).toLowerCase();
  const words = countWords(sample) || 1;
  const hits = LEGAL_DENSITY_KEYWORDS.filter((kw) => sample.includes(kw)).length;
  return hits / (words / 1000);
}

/**
 * @param {Document} doc
 * @returns {{ text: string; wordCount: number; title: string }}
 */
function extractDocumentFromDoc(doc) {
  const root = findReadableRoot(doc);
  const title =
    doc.querySelector('h1')?.textContent?.trim() || doc.title?.trim() || 'Untitled document';

  let text = extractWithHeadings(root);
  if (text.length > MAX_CHARS) {
    text = text.slice(0, MAX_CHARS);
  }

  return { text, wordCount: countWords(text), title };
}

/**
 * @returns {Promise<void>}
 */
function yieldToMain() {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => resolve(), { timeout: 48 });
    } else {
      setTimeout(resolve, 0);
    }
  });
}

/**
 * @param {Document} doc
 */
function isLargeDocument(doc) {
  const bodyLen = doc.body?.textContent?.length ?? 0;
  return bodyLen >= LARGE_DOC_CHAR_THRESHOLD;
}

/**
 * @param {Document} doc
 * @returns {Promise<Element>}
 */
async function findReadableRootAsync(doc) {
  for (const sel of SEMANTIC_SELECTORS) {
    const el = doc.querySelector(sel);
    if (el && scoreNode(el) > 0) {
      return el;
    }
  }

  const body = doc.body;
  if (!body) {
    return doc.documentElement;
  }

  const candidates = body.querySelectorAll('article, main, section, div');
  if (candidates.length <= CANDIDATE_YIELD_EVERY) {
    return findReadableRoot(doc);
  }

  let best = null;
  let bestScore = -Infinity;
  for (let i = 0; i < candidates.length; i++) {
    const el = candidates[i];
    const s = scoreNode(el);
    if (s > bestScore) {
      bestScore = s;
      best = el;
    }
    if (i > 0 && i % CANDIDATE_YIELD_EVERY === 0) {
      await yieldToMain();
    }
  }

  return best ?? body;
}

/**
 * @param {Element} root
 */
async function extractWithHeadingsAsync(root) {
  const clone = root.cloneNode(true);
  clone.querySelectorAll(STRIP_SELECTORS).forEach((el) => el.remove());

  const ownerDoc = root.ownerDocument ?? root;
  const parts = [];
  const walker = ownerDoc.createTreeWalker(clone, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);

  let node = walker.currentNode;
  let steps = 0;
  while (node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName;
      if (/^H[1-6]$/.test(tag)) {
        const heading = (node.textContent ?? '').trim();
        if (heading) {
          parts.push(`\n${'#'.repeat(Number(tag[1]))} ${heading}\n`);
        }
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      const parent = node.parentElement;
      if (!parent || !/^H[1-6]$/.test(parent.tagName)) {
        const t = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
        if (t) {
          parts.push(t);
        }
      }
    }
    node = walker.nextNode();
    steps++;
    if (steps % WALKER_YIELD_EVERY === 0) {
      await yieldToMain();
    }
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * @param {Document} doc
 * @returns {Promise<{ text: string; wordCount: number; title: string }>}
 */
async function extractDocumentFromDocAsync(doc) {
  const title =
    doc.querySelector('h1')?.textContent?.trim() || doc.title?.trim() || 'Untitled document';

  if (!isLargeDocument(doc)) {
    return extractDocumentFromDoc(doc);
  }

  const root = await findReadableRootAsync(doc);
  let text = await extractWithHeadingsAsync(root);
  if (text.length > MAX_CHARS) {
    text = text.slice(0, MAX_CHARS);
  }

  return { text, wordCount: countWords(text), title };
}
