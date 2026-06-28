const summarizeBtn = document.getElementById('summarize-btn');
const reanalyzeBtn = document.getElementById('reanalyze-btn');
const cancelBtn = document.getElementById('cancel-btn');
const analysisActions = document.getElementById('analysis-actions');
const settingsBtn = document.getElementById('settings-btn');
const optionsLink = document.getElementById('options-link');
const consentScreen = document.getElementById('consent-screen');
const consentDisclosure = document.getElementById('consent-disclosure');
const consentAcceptBtn = document.getElementById('consent-accept');
const consentDeclineBtn = document.getElementById('consent-decline');
const consentDeclinedEl = document.getElementById('consent-declined');
const policyDetectedEl = document.getElementById('policy-detected');
const setupScreen = document.getElementById('setup-screen');
const getKeyBtn = document.getElementById('get-key-btn');
const setupKeyInput = document.getElementById('setup-key-input');
const connectBtn = document.getElementById('connect-btn');
const setupResultEl = document.getElementById('setup-result');
const statusEl = document.getElementById('status');
const metaEl = document.getElementById('meta');
const summaryEl = document.getElementById('summary');
const progressEl = document.getElementById('progress');
const progressFill = document.getElementById('progress-fill');
const progressLabel = document.getElementById('progress-label');
const languageSelect = document.getElementById('language-select');
const notLegalScreen = document.getElementById('not-legal-screen');
const notLegalTitle = document.getElementById('not-legal-title');
const notLegalHint = document.getElementById('not-legal-hint');
const taglineEl = document.getElementById('tagline');

/** @type {number | null} */
let currentTabId = null;

/** @type {boolean} */
let consentGiven = false;

/** @type {boolean} */
let hasApiKey = false;

/** @type {boolean} */
let notLegal = false;

/** @type {'gemini' | 'openai' | 'anthropic' | 'grok'} */
let activeProviderId = 'gemini';

/** @type {{ force: boolean } | null} */
let pendingSummarize = null;

const ANALYSIS_SECTIONS = [
  { key: 'keyPoints', titleKey: 'section_keyPoints', defaultOpen: true },
  { key: 'riskyClauses', titleKey: 'section_riskyClauses', risk: true },
  { key: 'dataCollection', titleKey: 'section_dataCollection' },
  { key: 'thirdPartySharing', titleKey: 'section_thirdPartySharing' },
  { key: 'subscriptionTerms', titleKey: 'section_subscriptionTerms' },
  { key: 'cancellationRefund', titleKey: 'section_cancellationRefund' },
  { key: 'userObligations', titleKey: 'section_userObligations' },
  { key: 'legalClauses', titleKey: 'section_legalClauses' },
];

optionsLink?.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

settingsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

languageSelect.addEventListener('change', async () => {
  const lang = /** @type {'en' | 'zh' | 'ms' | 'ta'} */ (languageSelect.value);
  setLanguage(lang);
  applyI18n();
  const { settings } = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
  await chrome.runtime.sendMessage({
    type: 'SAVE_SETTINGS',
    settings: { ...settings, language: lang },
  });
});

consentAcceptBtn.addEventListener('click', acceptConsent);
consentDeclineBtn.addEventListener('click', declineConsent);

getKeyBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: getProviderConfig(activeProviderId).keyUrl });
});
connectBtn.addEventListener('click', connectSetupKey);

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
  if (changes.llmApiKey) {
    hasApiKey = Boolean(changes.llmApiKey.newValue);
    if (hasApiKey) {
      hideSetupScreen();
    }
  }
  if (changes.llmSettings?.newValue) {
    const s = changes.llmSettings.newValue;
    if (s.providerId) {
      activeProviderId = s.providerId;
    }
    if (s.language) {
      setLanguage(s.language);
      languageSelect.value = s.language;
      applyI18n();
    }
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
  analysisActions.hidden = notLegal ? true : false;

  if (!given) {
    hideSummary();
    metaEl.hidden = true;
    consentScreen.hidden = false;
  }
  updateActionButtons();
}

function showSetupScreen() {
  setupScreen.hidden = false;
  setupResultEl.hidden = true;
  setupResultEl.textContent = '';
  setupResultEl.className = 'setup-result';
  analysisActions.hidden = true;
  hideSummary();
  metaEl.hidden = true;
  clearStatus();
}

function hideSetupScreen() {
  setupScreen.hidden = true;
  analysisActions.hidden = false;
}

function showSetupResult(message, kind) {
  setupResultEl.hidden = false;
  setupResultEl.textContent = message;
  setupResultEl.className = `setup-result setup-result-${kind}`;
}

function friendlyConnectionError(message) {
  const text = String(message).toLowerCase();
  if (
    text.includes('invalid') ||
    text.includes('api key') ||
    text.includes('403') ||
    text.includes('401')
  ) {
    return "That key didn't work — check you copied all of it.";
  }
  if (text.includes('consent')) {
    return 'Please accept the privacy notice first, then try Connect again.';
  }
  if (text.includes('network') || text.includes('denied') || text.includes('permission')) {
    return 'Connection was blocked. Allow access when Chrome asks, then try again.';
  }
  return "Couldn't connect — double-check your key and try again.";
}

async function connectSetupKey() {
  const key = setupKeyInput.value.trim();
  if (!key) {
    showSetupResult('Paste your key from Google AI Studio first.', 'error');
    return;
  }

  if (!consentGiven) {
    pendingSummarize = pendingSummarize ?? { force: false };
    showConsentScreen();
    showSetupResult('Please accept the privacy notice first.', 'error');
    return;
  }

  connectBtn.disabled = true;
  showSetupResult('Checking your connection…', 'pending');

  const permOk = await ensureProviderHostPermission(activeProviderId);
  if (!permOk) {
    connectBtn.disabled = false;
    showSetupResult(t('permission_denied'), 'error');
    return;
  }

  const { settings } = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });

  const result = await chrome.runtime.sendMessage({
    type: 'TEST_CONNECTION',
    apiKey: key,
    settings,
  });

  if (result?.error) {
    connectBtn.disabled = false;
    showSetupResult(friendlyConnectionError(result.error), 'error');
    return;
  }

  await chrome.runtime.sendMessage({ type: 'SAVE_API_KEY', apiKey: key });
  hasApiKey = true;
  setupKeyInput.value = '';
  connectBtn.disabled = false;
  hideSetupScreen();

  const pending = pendingSummarize;
  pendingSummarize = null;
  if (pending) {
    await startSummarize(pending.force);
  }
}

/**
 * @param {{ detected?: boolean; notLegal?: boolean; docType?: string; confidence?: number; mode?: string; linkLabel?: string; wordCount?: number }} detection
 */
function renderPolicyDetected(detection) {
  if (detection?.notLegal) {
    setNotLegal(true);
    policyDetectedEl.hidden = true;
    return;
  }

  if (!detection?.detected) {
    policyDetectedEl.hidden = true;
    setNotLegal(false);
    return;
  }

  setNotLegal(false);
  const label = docTypeLabel(detection.docType ?? 'unknown');
  const confidence = Math.round((detection.confidence ?? 0) * 100);

  if (detection.mode === 'hub') {
    policyDetectedEl.textContent = t('policy_detected_hub', { label: label.toLowerCase() });
  } else {
    policyDetectedEl.textContent = t('policy_detected_doc', { label, confidence });
  }
  policyDetectedEl.hidden = false;
}

/** @param {boolean} value */
function setNotLegal(value) {
  notLegal = value;
  notLegalScreen.hidden = !value;
  if (value) {
    notLegalTitle.textContent = t('not_legal_title');
    notLegalHint.textContent = t('not_legal_hint');
  }
  analysisActions.hidden = value;
  if (value) {
    hideSummary();
    metaEl.hidden = true;
    policyDetectedEl.hidden = true;
  }
  updateActionButtons();
}

function updateActionButtons() {
  const blocked = !consentGiven || notLegal;
  summarizeBtn.disabled = blocked;
  reanalyzeBtn.disabled = blocked;
}

async function detectCurrentPage() {
  if (!currentTabId) {
    return;
  }

  try {
    const detection = await chrome.runtime.sendMessage({
      type: 'DETECT_TAB',
      tabId: currentTabId,
    });
    renderPolicyDetected(detection);
  } catch {
    policyDetectedEl.hidden = true;
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
  const permOk = await ensureProviderHostPermission(activeProviderId);
  if (!permOk) {
    showError(t('permission_denied'));
    return;
  }

  await chrome.runtime.sendMessage({ type: 'GRANT_CONSENT' });
  consentDeclinedEl.hidden = true;
  delete consentDeclinedEl.dataset.declined;
  setConsentUi(true);

  const pending = pendingSummarize;
  pendingSummarize = null;
  if (pending) {
    await startSummarize(pending.force);
  } else if (!hasApiKey) {
    showSetupScreen();
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

  const settings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
  hasApiKey = Boolean(settings?.hasApiKey);
  activeProviderId = settings?.settings?.providerId ?? 'gemini';
  const lang = settings?.settings?.language ?? 'en';
  setLanguage(lang);
  languageSelect.value = lang;
  applyI18n();
  setConsentUi(Boolean(settings?.consentGiven));

  await detectCurrentPage();

  if (!settings?.consentGiven || !currentTabId) {
    return;
  }

  if (!hasApiKey) {
    return;
  }

  if (notLegal) {
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
    showError(t('no_active_tab'));
    return;
  }

  if (notLegal) {
    return;
  }

  if (!consentGiven) {
    pendingSummarize = { force };
    showConsentScreen();
    return;
  }

  if (!hasApiKey) {
    pendingSummarize = { force };
    showSetupScreen();
    return;
  }

  const permOk = await ensureProviderHostPermission(activeProviderId);
  if (!permOk) {
    showError(t('permission_denied'));
    return;
  }

  setRunning(true);
  metaEl.hidden = true;
  clearStatus();
  showLoadingState(force ? t('reanalyzing') : undefined);
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

    if (result?.notLegal) {
      setNotLegal(true);
      hideProgress();
      setRunning(false);
      return;
    }

    if (result?.consentRequired) {
      pendingSummarize = { force };
      showConsentScreen();
      setRunning(false);
      return;
    }

    if (result?.needsOriginPermission) {
      hideProgress();
      promptOriginPermission(result.needsOriginPermission, force);
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
    showError(friendlySummarizeError(err.message ?? 'Something went wrong'));
    setRunning(false);
  }
}

/**
 * @param {{ origin: string; policyUrl: string }} detail
 * @param {boolean} force
 */
function promptOriginPermission(detail, force) {
  statusEl.hidden = false;
  statusEl.className = 'status warn';
  statusEl.innerHTML = `
    This page links to a policy on <strong>${escapeHtml(detail.origin)}</strong>.
    <button type="button" id="grant-origin-btn">Allow access</button>
  `;

  document.getElementById('grant-origin-btn')?.addEventListener(
    'click',
    async () => {
      const ok = await ensureOriginHostPermission(detail.policyUrl);
      if (!ok) {
        showError(`Access to ${detail.origin} was denied. Open the policy page directly instead.`);
        return;
      }
      clearStatus();
      await startSummarize(force);
    },
    { once: true },
  );
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
  summarizeBtn.disabled = running || !consentGiven || notLegal;
  reanalyzeBtn.disabled = running || !consentGiven || notLegal;
  cancelBtn.hidden = !running;
}

function applyI18n() {
  taglineEl.textContent = t('tagline');
  settingsBtn.textContent = t('settings');
  settingsBtn.title = t('settings');
  summarizeBtn.textContent = t('summarize_btn');
  reanalyzeBtn.textContent = t('reanalyze_btn');
  cancelBtn.textContent = t('cancel_btn');
  notLegalTitle.textContent = t('not_legal_title');
  notLegalHint.textContent = t('not_legal_hint');
  document.getElementById('language-label').textContent = t('language_label');
  const consentTitle = consentScreen.querySelector('h2');
  if (consentTitle) {
    consentTitle.textContent = t('consent_title');
  }
  consentAcceptBtn.textContent = t('consent_accept');
  consentDeclineBtn.textContent = t('consent_decline');
  consentDeclinedEl.textContent = t('consent_declined');
  const setupTitle = setupScreen.querySelector('h2');
  if (setupTitle) {
    setupTitle.textContent = t('setup_title');
  }
  const setupLead = setupScreen.querySelector('.setup-lead');
  if (setupLead) {
    setupLead.textContent = t('setup_lead');
  }
  getKeyBtn.textContent = t('setup_get_key');
  connectBtn.textContent = t('setup_step3_connect');
  if (optionsLink) {
    optionsLink.textContent = t('setup_more_options');
  }
}

/** @param {{ phase: string; current: number; total: number }} progress */
function showProgress(progress) {
  progressEl.hidden = false;
  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  progressFill.style.width = `${pct}%`;

  const labels = {
    detecting: t('progress_detecting'),
    fetching: t('progress_fetching'),
    summarizing: t('progress_summarizing'),
    chunking: t('progress_chunking', { current: progress.current, total: progress.total }),
    reducing: t('progress_reducing'),
  };
  progressLabel.textContent = labels[progress.phase] ?? t('progress_working');
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

function friendlySummarizeError(message) {
  const text = String(message).toLowerCase();
  if (
    text.includes('no longer available') ||
    text.includes('gemini-2.0') ||
    (text.includes('404') && text.includes('model'))
  ) {
    return 'That AI model is outdated. Open Settings (top right), set Model to gemini-2.5-flash, save, then try again.';
  }
  if (text.includes('invalid json') || text.includes('cut short') || text.includes('garbled')) {
    return 'The AI response was garbled. Click Re-analyze to try again. If it keeps failing, open Settings and confirm Model is gemini-2.5-flash.';
  }
  if (text.includes('invalid api key') || text.includes("key didn't work")) {
    return "Your key didn't work. Open Settings to check or replace it.";
  }
  return String(message);
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
    priorities: normalizePriorities(summary.priorities),
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

/** @param {unknown} raw */
function normalizePriorities(raw) {
  /** @type {import('../lib/types.js').PriorityConcerns} */
  const out = {
    sellsOrSharesData: { status: 'unclear', answer: '' },
    dataForAdvertising: { status: 'unclear', answer: '' },
    thirdPartySharing: { status: 'unclear', answer: '' },
    hasRefundPolicy: { status: 'unclear', answer: '' },
    hasCancellationPolicy: { status: 'unclear', answer: '' },
    paymentsRefundable: { status: 'unclear', answer: '' },
  };
  if (!raw || typeof raw !== 'object') {
    return out;
  }
  const obj = /** @type {Record<string, unknown>} */ (raw);
  for (const key of PRIORITY_KEYS) {
    const item = obj[key];
    if (!item || typeof item !== 'object') {
      continue;
    }
    const p = /** @type {Record<string, unknown>} */ (item);
    const status = String(p.status ?? 'unclear').toLowerCase();
    out[key] = {
      status: ['yes', 'no', 'unclear'].includes(status) ? status : 'unclear',
      answer: String(p.answer ?? '').trim(),
    };
  }
  return out;
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
    ? `<p class="status warn meta-notes">${escapeHtml(t('low_confidence'))}</p>`
    : '';

  const cacheNote = options.fromCache
    ? `<p class="status info meta-notes">${escapeHtml(t('cache_note'))}</p>`
    : '';

  const hubNote = doc.fetchedFromHub
    ? `<p class="status info meta-notes">${escapeHtml(t('from_hub'))}${
        doc.linkLabel ? `: ${escapeHtml(doc.linkLabel)}` : ''
      }${
        doc.originalUrl
          ? ` · <a href="${escapeHtml(doc.originalUrl)}" target="_blank" rel="noopener">${escapeHtml(t('hub_page'))}</a>`
          : ''
      }</p>`
    : '';

  metaEl.innerHTML = `
    ${confirmNote}
    ${cacheNote}
    ${hubNote}
    <span class="badge">${escapeHtml(doc.docType)}</span>
    <span>${doc.wordCount.toLocaleString()} ${escapeHtml(t('words'))}</span>
    · <span>${Math.round(doc.confidence * 100)}% ${escapeHtml(t('match'))}</span>
    ${normalized.confidence ? `· <span>${escapeHtml(String(normalized.confidence))} ${escapeHtml(t('confidence_label'))}</span>` : ''}
    <br /><a href="${escapeHtml(doc.sourceUrl)}" target="_blank" rel="noopener">${escapeHtml(t('view_source'))}</a>
  `;
  metaEl.hidden = false;

  const prioritiesHtml = renderPriorities(normalized.priorities);
  const riskMeterHtml = renderRiskMeter(normalized.riskScore);
  const severityBarHtml = renderSeverityBar(normalized.riskScore);
  const riskBreakdownHtml = renderRiskBreakdown(normalized.riskScore);
  const sectionsHtml = ANALYSIS_SECTIONS.map((section) =>
    renderCollapsibleSection(section, normalized[section.key]),
  ).join('');

  const hasContent =
    prioritiesHtml || normalized.plainSummary || riskMeterHtml || riskBreakdownHtml || sectionsHtml;

  summaryEl.innerHTML = hasContent
    ? `
    ${prioritiesHtml}
    ${riskMeterHtml}
    ${severityBarHtml}
    ${riskBreakdownHtml}
    <div class="summary-header">
      <h3 class="plain-summary-heading">${escapeHtml(t('plain_summary'))}</h3>
      <p class="plain-summary">${
        normalized.plainSummary
          ? escapeHtml(normalized.plainSummary)
          : `<span class="empty-state" style="padding:0;border:none;background:none">${escapeHtml(t('empty_summary'))}</span>`
      }</p>
    </div>
    ${sectionsHtml}
  `
    : `<div class="empty-state">${escapeHtml(t('empty_sections'))}</div>`;

  summaryEl.hidden = false;
}

/** @param {import('../lib/types.js').PriorityConcerns} priorities */
function renderPriorities(priorities) {
  const cards = PRIORITY_KEYS.map((key) => {
    const item = priorities[key] ?? { status: 'unclear', answer: '' };
    const status = ['yes', 'no', 'unclear'].includes(item.status) ? item.status : 'unclear';
    const statusLabel = t(`status_${status}`);
    return `
      <div class="priority-card priority-${status}">
        <div class="priority-head">
          <span class="priority-question">${escapeHtml(t(`priority_${key}`))}</span>
          <span class="priority-chip chip-${status}">${escapeHtml(statusLabel)}</span>
        </div>
        ${item.answer ? `<p class="priority-answer">${escapeHtml(item.answer)}</p>` : ''}
      </div>
    `;
  }).join('');

  return `
    <section class="priorities-section">
      <h3 class="section-heading">${escapeHtml(t('priority_heading'))}</h3>
      <div class="priority-cards">${cards}</div>
    </section>
  `;
}

/** @param {{ value: number; label: string }} riskScore */
function renderRiskMeter(riskScore) {
  const riskClass = riskSeverityClass(riskScore);
  return `
    <div class="risk-meter ${riskClass}">
      <div class="risk-meter-head">
        <span class="risk-meter-label">${escapeHtml(t('risk_meter'))}</span>
        <span class="risk-meter-value">${riskScore.value}/100 · ${escapeHtml(formatRiskLabel(riskScore.label))}</span>
      </div>
      <div class="risk-meter-track" role="meter" aria-valuenow="${riskScore.value}" aria-valuemin="0" aria-valuemax="100">
        <div class="risk-meter-fill" style="width:${riskScore.value}%"></div>
      </div>
    </div>
  `;
}

/** @param {{ factors: import('../lib/types.js').RiskFactor[] }} riskScore */
function renderSeverityBar(riskScore) {
  const counts = { normal: 0, caution: 0, red_flag: 0 };
  for (const f of riskScore.factors ?? []) {
    const s = ['normal', 'caution', 'red_flag'].includes(f.severity) ? f.severity : 'normal';
    counts[s]++;
  }
  const total = counts.normal + counts.caution + counts.red_flag;
  if (!total) {
    return '';
  }

  const pct = (n) => Math.round((n / total) * 100);
  return `
    <div class="severity-bar-wrap">
      <span class="severity-bar-label">${escapeHtml(t('severity_breakdown'))}</span>
      <div class="severity-bar" title="normal ${counts.normal}, caution ${counts.caution}, red flag ${counts.red_flag}">
        ${counts.red_flag ? `<span class="seg red-flag" style="width:${pct(counts.red_flag)}%"></span>` : ''}
        ${counts.caution ? `<span class="seg caution" style="width:${pct(counts.caution)}%"></span>` : ''}
        ${counts.normal ? `<span class="seg normal" style="width:${pct(counts.normal)}%"></span>` : ''}
      </div>
    </div>
  `;
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
            <summary>${escapeHtml(t('view_clause'))}</summary>
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
        ${escapeHtml(t('risk_breakdown'))}
        <span class="count">${riskScore.factors.length}</span>
      </summary>
      <div class="details-body risk-factors">${rows}</div>
    </details>
  `;
}

/**
 * @param {{ key: string; titleKey: string; risk?: boolean; defaultOpen?: boolean }} section
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
        ${escapeHtml(t(section.titleKey))}
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
