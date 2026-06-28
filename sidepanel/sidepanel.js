const summarizeBtn = document.getElementById('summarize-btn');
const cancelBtn = document.getElementById('cancel-btn');
const optionsLink = document.getElementById('options-link');
const apiKeyBanner = document.getElementById('api-key-banner');
const statusEl = document.getElementById('status');
const metaEl = document.getElementById('meta');
const summaryEl = document.getElementById('summary');
const progressEl = document.getElementById('progress');
const progressFill = document.getElementById('progress-fill');
const progressLabel = document.getElementById('progress-label');

/** @type {number | null} */
let currentTabId = null;

const ANALYSIS_SECTIONS = [
  { key: 'keyPoints', title: 'Key points', defaultOpen: true },
  { key: 'riskyClauses', title: 'Risky clauses', risk: true, defaultOpen: true },
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

summarizeBtn.addEventListener('click', startSummarize);
cancelBtn.addEventListener('click', cancelSummarize);

chrome.runtime.onMessage.addListener((message) => {
  if (message.tabId !== currentTabId) {
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

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabId = tab?.id ?? null;

  const { hasApiKey } = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
  apiKeyBanner.hidden = hasApiKey;

  if (currentTabId) {
    const { cached } = await chrome.runtime.sendMessage({
      type: 'GET_TAB_SUMMARY',
      tabId: currentTabId,
    });
    if (cached) {
      renderResult(cached.doc, cached.summary);
    }
  }
}

async function startSummarize() {
  if (!currentTabId) {
    showError('No active tab found');
    return;
  }

  setRunning(true);
  metaEl.hidden = true;
  clearStatus();
  showLoadingState();
  showProgress({ phase: 'detecting', current: 0, total: 1 });

  try {
    const result = await chrome.runtime.sendMessage({
      type: 'SUMMARIZE_TAB',
      tabId: currentTabId,
    });

    if (result?.error) {
      throw new Error(result.error);
    }

    if (result?.doc && result?.summary) {
      hideProgress();
      renderResult(result.doc, result.summary);
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

function showLoadingState() {
  summaryEl.hidden = false;
  summaryEl.innerHTML = `
    <div class="loading-state">
      <div class="loading-spinner" aria-hidden="true"></div>
      <p>Reading and analyzing the document…</p>
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
  let score = 50;
  let label = 'Moderate';

  if (scoreRaw && typeof scoreRaw === 'object') {
    const rs = /** @type {{ score?: number; label?: string }} */ (scoreRaw);
    score = Number.isFinite(rs.score) ? Math.min(100, Math.max(0, Math.round(rs.score))) : 50;
    label = rs.label || riskLabelFromScore(score);
  } else if (risky.length >= 3) {
    score = 75;
    label = 'High';
  } else if (risky.length >= 1) {
    score = 45;
    label = 'Moderate';
  } else {
    score = 15;
    label = 'Low';
  }

  return {
    plainSummary: String(summary.plainSummary ?? summary.tldr ?? ''),
    riskScore: { score, label },
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
    return 'High';
  }
  if (score >= 34) {
    return 'Moderate';
  }
  return 'Low';
}

/** @param {{ score: number; label: string }} riskScore */
function riskSeverityClass(riskScore) {
  if (riskScore.score >= 67) {
    return 'risk-high';
  }
  if (riskScore.score >= 34) {
    return 'risk-moderate';
  }
  return 'risk-low';
}

function renderResult(doc, summary) {
  const normalized = normalizeSummary(summary);

  const confirmNote = doc.needsConfirmation
    ? '<p class="status warn meta-notes">Low confidence — please verify this is the right document.</p>'
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
    ${hubNote}
    <span class="badge">${escapeHtml(doc.docType)}</span>
    <span>${doc.wordCount.toLocaleString()} words</span>
    · <span>${Math.round(doc.confidence * 100)}% match</span>
    ${normalized.confidence ? `· <span>${escapeHtml(String(normalized.confidence))} confidence</span>` : ''}
    <br /><a href="${escapeHtml(doc.sourceUrl)}" target="_blank" rel="noopener">View source</a>
  `;
  metaEl.hidden = false;

  const riskClass = riskSeverityClass(normalized.riskScore);
  const sectionsHtml = ANALYSIS_SECTIONS.map((section) =>
    renderCollapsibleSection(section, normalized[section.key]),
  ).join('');

  const hasContent = normalized.plainSummary || sectionsHtml;

  summaryEl.innerHTML = hasContent
    ? `
    <div class="summary-header">
      <p class="plain-summary">${
        normalized.plainSummary
          ? escapeHtml(normalized.plainSummary)
          : '<span class="empty-state" style="padding:0;border:none;background:none">No summary available.</span>'
      }</p>
      <div class="risk-badge ${riskClass}" title="Risk score ${normalized.riskScore.score}/100">
        <span class="risk-score">${normalized.riskScore.score}</span>
        <span class="risk-label">${escapeHtml(normalized.riskScore.label)}</span>
      </div>
    </div>
    ${sectionsHtml}
  `
    : `<div class="empty-state">No analysis sections returned.</div>`;

  summaryEl.hidden = false;
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
