const form = document.getElementById('settings-form');
const apiKeyInput = document.getElementById('api-key');
const keySavedEl = document.getElementById('key-saved');
const providerUrlInput = document.getElementById('provider-url');
const modelInput = document.getElementById('model');
const maxChunkInput = document.getElementById('max-chunk-tokens');
const temperatureInput = document.getElementById('temperature');
const saveKeyBtn = document.getElementById('save-key-btn');
const testBtn = document.getElementById('test-btn');
const clearKeyBtn = document.getElementById('clear-key-btn');
const saveStatus = document.getElementById('save-status');
const consentDisclosure = document.getElementById('consent-disclosure');
const consentStatus = document.getElementById('consent-status');
const withdrawConsentBtn = document.getElementById('withdraw-consent-btn');

const LLM_STORAGE_KEYS = {
  apiKey: 'llmApiKey',
  settings: 'llmSettings',
};

const DEFAULTS = {
  providerUrl: 'https://generativelanguage.googleapis.com/v1beta',
  model: 'gemini-2.0-flash',
  maxChunkTokens: 3000,
  temperature: 0.2,
};

loadSettings();

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  await saveProviderSettings();
});

saveKeyBtn.addEventListener('click', saveApiKey);
testBtn.addEventListener('click', testConnection);
clearKeyBtn.addEventListener('click', clearApiKey);
withdrawConsentBtn.addEventListener('click', withdrawConsent);

async function loadSettings() {
  renderConsentDisclosure();
  await refreshConsentUi();

  const result = await chrome.storage.local.get([LLM_STORAGE_KEYS.apiKey, LLM_STORAGE_KEYS.settings]);
  const settings = { ...DEFAULTS, ...result[LLM_STORAGE_KEYS.settings] };

  updateKeySavedUi(Boolean(result[LLM_STORAGE_KEYS.apiKey]));
  providerUrlInput.value = settings.providerUrl;
  modelInput.value = settings.model;
  maxChunkInput.value = String(settings.maxChunkTokens);
  temperatureInput.value = String(settings.temperature);
}

/** @param {boolean} hasKey */
function updateKeySavedUi(hasKey) {
  keySavedEl.hidden = !hasKey;
  apiKeyInput.placeholder = hasKey ? 'Enter new key to replace' : 'sk-…';
}

function readSettings() {
  return {
    providerUrl: providerUrlInput.value.trim() || DEFAULTS.providerUrl,
    model: modelInput.value.trim() || DEFAULTS.model,
    maxChunkTokens: Number(maxChunkInput.value) || DEFAULTS.maxChunkTokens,
    temperature: Number(temperatureInput.value) ?? DEFAULTS.temperature,
  };
}

async function saveApiKey() {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    showStatus('Enter an API key to save', true);
    return;
  }

  await chrome.storage.local.set({ [LLM_STORAGE_KEYS.apiKey]: apiKey });
  apiKeyInput.value = '';
  updateKeySavedUi(true);
  showStatus('API key saved');
}

async function saveProviderSettings() {
  await chrome.storage.local.set({ [LLM_STORAGE_KEYS.settings]: readSettings() });
  showStatus('Provider settings saved');
}

async function testConnection() {
  const consent = await getConsentState();
  if (!consent.given) {
    showStatus('Accept privacy consent in the side panel before testing the API.', true);
    return;
  }

  const settings = readSettings();
  const typedKey = apiKeyInput.value.trim();
  const stored = await chrome.storage.local.get(LLM_STORAGE_KEYS.apiKey);
  const apiKey = typedKey || stored[LLM_STORAGE_KEYS.apiKey] || '';

  if (!apiKey) {
    showStatus('Enter or save an API key first', true);
    return;
  }

  const geminiOk = await ensureGeminiHostPermission();
  if (!geminiOk) {
    showStatus('Network access to Gemini was denied.', true);
    return;
  }

  setBusy(true);
  showStatus('Testing connection…', false, true);

  const result = await chrome.runtime.sendMessage({
    type: 'TEST_CONNECTION',
    apiKey,
    settings,
  });

  setBusy(false);

  if (result?.error) {
    showStatus(result.error, true);
    return;
  }

  showStatus('Connection successful');
}

async function clearApiKey() {
  await chrome.storage.local.remove(LLM_STORAGE_KEYS.apiKey);
  apiKeyInput.value = '';
  updateKeySavedUi(false);
  showStatus('API key cleared');
}

/** @param {boolean} busy */
function setBusy(busy) {
  saveKeyBtn.disabled = busy;
  testBtn.disabled = busy;
  clearKeyBtn.disabled = busy;
}

/** @param {string} text @param {boolean} [isError] @param {boolean} [pending] */
function showStatus(text, isError = false, pending = false) {
  saveStatus.textContent = text;
  saveStatus.className = isError ? 'status error' : pending ? 'status pending' : 'status';
  saveStatus.hidden = false;
}

function renderConsentDisclosure() {
  consentDisclosure.innerHTML = CONSENT_DISCLOSURE_ITEMS.map(
    (item) => `<li>${escapeHtml(item)}</li>`,
  ).join('');
}

async function refreshConsentUi() {
  const state = await getConsentState();
  consentStatus.textContent = state.given
    ? `Consent given (version ${CURRENT_CONSENT_VERSION}).`
    : 'Consent not given — analysis is disabled until you accept in the side panel.';
  consentStatus.className = state.given ? 'consent-status given' : 'consent-status pending';
  withdrawConsentBtn.hidden = !state.given;
}

async function withdrawConsent() {
  await chrome.runtime.sendMessage({ type: 'WITHDRAW_CONSENT' });
  await refreshConsentUi();
  showStatus('Consent withdrawn. No page text will be sent to Gemini until you accept again.');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
