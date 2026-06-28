const summarizeBtn = document.getElementById('summarize-btn');
const reanalyzeBtn = document.getElementById('reanalyze-btn');
const cancelBtn = document.getElementById('cancel-btn');
const analysisActions = document.getElementById('analysis-actions');
const optionsLink = document.getElementById('options-link');
const consentScreen = document.getElementById('consent-screen');
const consentDisclosure = document.getElementById('consent-disclosure');
const consentAcceptBtn = document.getElementById('consent-accept');
const consentDeclineBtn = document.getElementById('consent-decline');
const consentDeclinedEl = document.getElementById('consent-declined');
const apiKeyBanner = document.getElementById('api-key-banner');
const statusEl = document.getElementById('status');
const metaEl = document.getElementById('meta');
const summaryEl = document.getElementById('summary');
const progressEl = document.getElementById('progress');
const progressFill = document.getElementById('progress-fill');
const progressLabel = document.getElementById('progress-label');

/** @type {number | null} */
let currentTabId = null;

/** @type {boolean} */
let consentGiven = false;

/** @type {{ force: boolean } | null} */
let pendingSummarize = null;

const ANALYSIS_SECTIONS = [
  { key: 'keyPoints', title: 'Key points', defaultOpen: true },
  { key: 'riskyClauses', title: 'Risky clauses', risk: true },
  { key: 'dataCollection', title: 'Data collection' },
  { key: 'thirdPartySharing', title: 'Third-party sharing' },
  { key: 'subscriptionTerms', title: 'Subscription terms' },
  { key: 'cancellationRefund', title: 'Cancellation & refunds' },
  { key: 'userObligations', title: 'Your obligations' },
  { key: 'legalClauses', title: 'Legal clauses' },
];

optionsLink.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

consentAcceptBtn.addEventListener('click', acceptConsent);
consentDeclineBtn.addEventListener('click', declineConsent);

summarizeBtn.addEventListener('click', () => startSummarize(false));
reanalyzeBtn.addEventListener('click', () => startSummarize(true));
cancelBtn.addEventListener('click', cancelSummarize);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') {
    return;
  }
  if (changes.consentGiven || changes.consentVersion) {
    refreshConsentFromStorage();
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.tabId !== currentTabId) {
    return;
  }

  if (message.type === 'CONSENT_REQUIRED') {
    pendingSummarize = { force: Boolean(message.force) };
    showConsentScreen();
    hideProgress();
    setRunning(false);
    return;
  }

  if (message.type === 'JOB_PROGRESS') {
    showProgress(message.progress);
  }

  if (message.type === 'JOB_COMPLETE') {
    hideProgress();
    clearStatus();
    renderResult(message.doc, message.summary);
    setRunning(false);
  }

  if (message.type === 'JOB_ERROR') {
    hideProgress();
    showError(message.error.message);
    setRunning(false);
  }
});

init();

function renderConsentDisclosure() {
  consentDisclosure.innerHTML = CONSENT_DISCLOSURE_ITEMS.map(
    (item) => `<li>${escapeHtml(item)}</li>`,
  ).join('');
}

/** @param {boolean} given */
function setConsentUi(given) {
  consentGiven = given;
  consentScreen.hidden = given;
  consentDeclinedEl.hidden = given || !consentDeclinedEl.dataset.declined;
  summarizeBtn.disabled = !given;
  reanalyzeBtn.disabled = !given;
  analysisActions.hidden = false;

  if (!given) {
    hideSummary();
    metaEl.hidden = true;
    consentScreen.hidden = false;
  }
}

function showConsentScreen() {
  consentScreen.hidden = false;
  consentDeclinedEl.hidden = true;
  delete consentDeclinedEl.dataset.declined;
  hideSummary();
  metaEl.hidden = true;
  clearStatus();
}

function declineConsent() {
  pendingSummarize = null;
  consentDeclinedEl.dataset.declined = '1';
  consentDeclinedEl.hidden = false;
  hideProgress();
  hideSummary();
  metaEl.hidden = true;
  clearStatus();
  setRunning(false);
}

async function acceptConsent() {
  await chrome.runtime.sendMessage({ type: 'GRANT_CONSENT' });
  consentDeclinedEl.hidden = true;
  delete consentDeclinedEl.dataset.declined;
  setConsentUi(true);

  const pending = pendingSummarize;
  pendingSummarize = null;
  if (pending) {
    await startSummarize(pending.force);
  }
}

async function refreshConsentFromStorage() {
  const given = await hasConsent();
  if (given) {
    setConsentUi(true);
    return;
  }
  setConsentUi(false);
  pendingSummarize = null;
}

async function init() {
  renderConsentDisclosure();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabId = tab?.id ?? null;

  const { hasApiKey, consentGiven: given } = await chrome.runtime.sendMessage({
    type: 'GET_SETTINGS',
  });
  apiKeyBanner.hidden = hasApiKey;
  setConsentUi(Boolean(given));

  if (!given || !currentTabId) {
    return;
  }

  const { cached } = await chrome.runtime.sendMessage({
    type: 'GET_TAB_SUMMARY',
    tabId: currentTabId,
  });
  if (cached) {
    renderResult(cached.doc, cached.summary, { fromCache: cached.fromCache });
  }
}

async function startSummarize(force = false) {
  if (!currentTabId) {
    showError('No active tab found');
    return;
  }

  if (!consentGiven) {
    pendingSummarize = { force };
    showConsentScreen();
    return;
  }

  setRunning(true);
  metaEl.hidden = true;
  clearStatus();
  showLoadingState(force ? 'Re-analyzing (cache bypassed)…' : undefined);
  showProgress({ phase: 'detecting', current: 0, total: 1 });

  try {
    const result = await chrome.runtime.sendMessage({
      type: 'SUMMARIZE_TAB',
      tabId: currentTabId,
      force,
    });

    if (result?.error) {
      throw new Error(result.error);
    }

    if (result?.consentRequired) {
      pendingSummarize = { force };
      showConsentScreen();
      setRunning(false);
      return;
    }

    if (result?.doc && result?.summary) {
      hideProgress();
      renderResult(result.doc, result.summary, { fromCache: result.fromCache });
      setRunning(false);
    }
  } catch (err) {
    hideProgress();
    showError(err.message ?? 'Something went wrong');
    setRunning(false);
  }
}

async function cancelSummarize() {
  if (currentTabId) {
    await chrome.runtime.sendMessage({ type: 'CANCEL_JOB', tabId: currentTabId });
  }
  hideProgress();
  showInfo('Cancelled');
  hideSummary();
  setRunning(false);
}

/** @param {boolean} running */
function setRunning(running) {
  summarizeBtn.disabled = running;
  reanalyzeBtn.disabled = running;
  cancelBtn.hidden = !running;
}

/** @param {{ phase: string; current: number; total: number }} progress */
function showProgress(progress) {
  progressEl.hidden = false;
  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  progressFill.style.width = `${pct}%`;

  const labels = {
    detecting: 'Detecting legal document…',
    fetching: 'Fetching linked policy…',
    summarizing: 'Analyzing document…',
    chunking: `Analyzing section ${progress.current} of ${progress.total}…`,
    reducing: 'Combining results…',
  };
  progressLabel.textContent = labels[progress.phase] ?? 'Working…';
}

function hideProgress() {
  progressEl.hidden = true;
  progressFill.style.width = '0%';
}

/** @param {string} [message] */
function showLoadingState(message) {
  summaryEl.hidden = false;
  summaryEl.innerHTML = `
    <div class="loading-state">
      <div class="loading-spinner" aria-hidden="true"></div>
      <p>${escapeHtml(message ?? 'Reading and analyzing the document…')}</p>
    </div>
  `;
}

function hideSummary() {
  summaryEl.hidden = true;
  summaryEl.innerHTML = '';
}

function showError(message) {
  statusEl.textContent = message;
  statusEl.className = 'status error';
  statusEl.hidden = false;
  summaryEl.hidden = false;
  summaryEl.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function showInfo(message) {
  statusEl.textContent = message;
  statusEl.className = 'status info';
  statusEl.hidden = false;
}

function clearStatus() {
  statusEl.textContent = '';
  statusEl.hidden = true;
}

/**
 * @param {Record<string, unknown>} summary
 */
function normalizeSummary(summary) {
  const risky = /** @type {string[]} */ (
    summary.riskyClauses ?? summary.redFlags ?? []
  );
  const scoreRaw = summary.riskScore;
  let value = 50;
  let label = 'medium';
  /** @type {import('../lib/types.js').RiskFactor[]} */
  let factors = [];

  if (scoreRaw && typeof scoreRaw === 'object') {
    const rs = /** @type {{ value?: number; score?: number; label?: string; factors?: unknown[] }} */ (
      scoreRaw
    );
    const rawValue = rs.value ?? rs.score;
    value = Number.isFinite(rawValue)
      ? Math.min(100, Math.max(0, Math.round(rawValue)))
      : 50;
    label = normalizeRiskLabel(rs.label || riskLabelFromScore(value));
    if (Array.isArray(rs.factors)) {
      factors = rs.factors
        .filter((f) => f && typeof f === 'object')
        .map((f) => {
          const factor = /** @type {Record<string, unknown>} */ (f);
          return {
            clause: String(factor.clause ?? ''),
            category: String(factor.category ?? 'other'),
            severity: String(factor.severity ?? 'normal'),
            why: String(factor.why ?? ''),
          };
        })
        .filter((f) => f.clause && f.why);
    }
  } else if (risky.length >= 3) {
    value = 75;
    label = 'high';
  } else if (risky.length >= 1) {
    value = 45;
    label = 'medium';
  } else {
    value = 15;
    label = 'low';
  }

  return {
    plainSummary: String(summary.plainSummary ?? summary.tldr ?? ''),
    riskScore: { value, label, factors },
    keyPoints: /** @type {string[]} */ (summary.keyPoints ?? []),
    riskyClauses: risky,
    dataCollection: /** @type {string[]} */ (
      summary.dataCollection ?? summary.dataCollected ?? []
    ),
    thirdPartySharing: /** @type {string[]} */ (summary.thirdPartySharing ?? []),
    subscriptionTerms: /** @type {string[]} */ (summary.subscriptionTerms ?? []),
    cancellationRefund: /** @type {string[]} */ (summary.cancellationRefund ?? []),
    userObligations: /** @type {string[]} */ (
      summary.userObligations ?? summary.obligations ?? []
    ),
    legalClauses: /** @type {string[]} */ (
      summary.legalClauses ??
      [
        ...(Array.isArray(summary.yourRights) ? summary.yourRights : []),
        ...(Array.isArray(summary.cookies) ? summary.cookies : []),
      ]
    ),
    confidence: summary.confidence,
  };
}

/** @param {number} score */
function riskLabelFromScore(score) {
  if (score >= 67) {
    return 'high';
  }
  if (score >= 34) {
    return 'medium';
  }
  return 'low';
}

/** @param {string} raw */
function normalizeRiskLabel(raw) {
  const s = String(raw).toLowerCase().trim();
  if (s === 'high') {
    return 'high';
  }
  if (s === 'low') {
    return 'low';
  }
  if (s === 'medium' || s === 'moderate') {
    return 'medium';
  }
  return 'medium';
}

/** @param {{ value: number; label: string }} riskScore */
function riskSeverityClass(riskScore) {
  if (riskScore.label === 'high') {
    return 'risk-high';
  }
  if (riskScore.label === 'medium') {
    return 'risk-medium';
  }
  return 'risk-low';
}

const CATEGORY_LABELS = {
  data_collection: 'Data collection',
  third_party_sharing: 'Third-party sharing',
  auto_renewal: 'Auto-renewal',
  cancellation: 'Cancellation',
  liability: 'Liability',
  content_rights: 'Content rights',
  other: 'Other',
};

/** @param {string} category */
function formatCategory(category) {
  return CATEGORY_LABELS[category] ?? category.replace(/_/g, ' ');
}

/** @param {string} label */
function formatRiskLabel(label) {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function renderResult(doc, summary, options = {}) {
  const normalized = normalizeSummary(summary);

  const confirmNote = doc.needsConfirmation
    ? '<p class="status warn meta-notes">Low confidence — please verify this is the right document.</p>'
    : '';

  const cacheNote = options.fromCache
    ? '<p class="status info meta-notes">Loaded from cache — use Re-analyze for a fresh LLM pass.</p>'
    : '';

  const hubNote = doc.fetchedFromHub
    ? `<p class="status info meta-notes">From linked policy${doc.linkLabel ? `: ${escapeHtml(doc.linkLabel)}` : ''}${
        doc.originalUrl
          ? ` · <a href="${escapeHtml(doc.originalUrl)}" target="_blank" rel="noopener">hub page</a>`
          : ''
      }</p>`
    : '';

  metaEl.innerHTML = `
    ${confirmNote}
    ${cacheNote}
    ${hubNote}
    <span class="badge">${escapeHtml(doc.docType)}</span>
    <span>${doc.wordCount.toLocaleString()} words</span>
    · <span>${Math.round(doc.confidence * 100)}% match</span>
    ${normalized.confidence ? `· <span>${escapeHtml(String(normalized.confidence))} confidence</span>` : ''}
    <br /><a href="${escapeHtml(doc.sourceUrl)}" target="_blank" rel="noopener">View source</a>
  `;
  metaEl.hidden = false;

  const riskClass = riskSeverityClass(normalized.riskScore);
  const riskBreakdownHtml = renderRiskBreakdown(normalized.riskScore);
  const sectionsHtml = ANALYSIS_SECTIONS.map((section) =>
    renderCollapsibleSection(section, normalized[section.key]),
  ).join('');

  const hasContent = normalized.plainSummary || riskBreakdownHtml || sectionsHtml;

  summaryEl.innerHTML = hasContent
    ? `
    <div class="summary-header">
      <p class="plain-summary">${
        normalized.plainSummary
          ? escapeHtml(normalized.plainSummary)
          : '<span class="empty-state" style="padding:0;border:none;background:none">No summary available.</span>'
      }</p>
      <div class="risk-badge ${riskClass}" title="Risk score ${normalized.riskScore.value}/100">
        <span class="risk-score">${normalized.riskScore.value}</span>
        <span class="risk-label">${escapeHtml(formatRiskLabel(normalized.riskScore.label))}</span>
      </div>
    </div>
    ${riskBreakdownHtml}
    ${sectionsHtml}
  `
    : `<div class="empty-state">No analysis sections returned.</div>`;

  summaryEl.hidden = false;
}

/**
 * @param {{ value: number; label: string; factors: import('../lib/types.js').RiskFactor[] }} riskScore
 */
function renderRiskBreakdown(riskScore) {
  if (!riskScore.factors?.length) {
    return '';
  }

  const rows = riskScore.factors
    .map((factor) => {
      const severity = ['normal', 'caution', 'red_flag'].includes(factor.severity)
        ? factor.severity
        : 'normal';
      return `
      <div class="risk-factor">
        <span class="severity-dot severity-${severity}" title="${escapeHtml(severity.replace('_', ' '))}"></span>
        <div class="risk-factor-body">
          <div class="factor-head">
            <span class="factor-category">${escapeHtml(formatCategory(factor.category))}</span>
            <span class="factor-why">${escapeHtml(factor.why)}</span>
          </div>
          <details class="clause-quote">
            <summary>View clause</summary>
            <blockquote>${escapeHtml(factor.clause)}</blockquote>
          </details>
        </div>
      </div>
    `;
    })
    .join('');

  return `
    <details class="details-section risk-breakdown" open>
      <summary>
        Risk breakdown
        <span class="count">${riskScore.factors.length}</span>
      </summary>
      <div class="details-body risk-factors">${rows}</div>
    </details>
  `;
}

/**
 * @param {{ key: string; title: string; risk?: boolean; defaultOpen?: boolean }} section
 * @param {string[]} items
 */
function renderCollapsibleSection(section, items) {
  if (!items?.length) {
    return '';
  }

  const openAttr = section.defaultOpen ? ' open' : '';
  const riskClass = section.risk ? ' risk-section' : '';
  const lis = items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');

  return `
    <details class="details-section${riskClass}"${openAttr}>
      <summary>
        ${escapeHtml(section.title)}
        <span class="count">${items.length}</span>
      </summary>
      <div class="details-body">
        <ul>${lis}</ul>
      </div>
    </details>
  `;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
