const form = document.getElementById('settings-form');
const apiKeyInput = document.getElementById('api-key');
const keySavedEl = document.getElementById('key-saved');
const providerIdSelect = document.getElementById('provider-id');
const providerHint = document.getElementById('provider-hint');
const providerKeyHint = document.getElementById('provider-key-hint');
const languageSelect = document.getElementById('language');
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
const apiKeySection = document.getElementById('api-key-section');

const LLM_STORAGE_KEYS = {
  apiKey: 'llmApiKey',
  settings: 'llmSettings',
};

/** @type {string | null} */
let lastProviderId = null;

loadSettings();

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  await saveProviderSettings();
});

providerIdSelect.addEventListener('change', onProviderChange);
saveKeyBtn.addEventListener('click', saveApiKey);
testBtn.addEventListener('click', testConnection);
clearKeyBtn.addEventListener('click', clearApiKey);
withdrawConsentBtn.addEventListener('click', withdrawConsent);

function onProviderChange() {
  const providerId = providerIdSelect.value;
  const config = getProviderConfig(providerId);
  const isLocal = providerId === 'chrome';

  modelInput.placeholder = config.defaultModel;
  providerUrlInput.placeholder = config.defaultBaseUrl || 'Not used for on-device AI';
  providerHint.textContent = isLocal
    ? `${config.label} — summarization runs on your device. No cloud API key or network permission needed. Requires Chrome 131+ with Gemini Nano enabled.`
    : `${config.label} — network access is requested when you test or summarize.`;
  providerKeyHint.textContent = isLocal
    ? 'No API key needed for Chrome on-device AI.'
    : `API key for ${config.label}. Only one key is stored at a time.`;

  if (apiKeySection) {
    apiKeySection.hidden = isLocal;
  }

  if (lastProviderId && lastProviderId !== providerId && !isLocal) {
    showStatus('Provider changed — you may need a new API key for this provider.', false);
  }
}

async function loadSettings() {
  renderConsentDisclosure();
  await refreshConsentUi();

  if (typeof isFirefox !== 'undefined' && isFirefox) {
    const chromeOpt = providerIdSelect.querySelector('option[value="chrome"]');
    chromeOpt?.remove();
  }

  const result = await chrome.storage.local.get([LLM_STORAGE_KEYS.apiKey, LLM_STORAGE_KEYS.settings]);
  const stored = result[LLM_STORAGE_KEYS.settings] ?? {};
  let providerId = stored.providerId ?? 'gemini';
  if (typeof isFirefox !== 'undefined' && isFirefox && providerId === 'chrome') {
    providerId = 'gemini';
  }
  const config = getProviderConfig(providerId);
  const settings = {
    providerId,
    providerUrl: stored.providerUrl ?? config.defaultBaseUrl,
    model: stored.model ?? config.defaultModel,
    language: stored.language ?? 'en',
    maxChunkTokens: stored.maxChunkTokens ?? 3000,
    temperature: stored.temperature ?? 0.1,
  };

  if (typeof isFirefox !== 'undefined' && isFirefox && stored.providerId === 'chrome') {
    await chrome.storage.local.set({
      [LLM_STORAGE_KEYS.settings]: { ...stored, providerId: 'gemini' },
    });
  }

  lastProviderId = providerId;
  updateKeySavedUi(Boolean(result[LLM_STORAGE_KEYS.apiKey]));
  providerIdSelect.value = providerId;
  languageSelect.value = settings.language;
  providerUrlInput.value = settings.providerUrl;
  modelInput.value = settings.model === 'gemini-2.0-flash' ? 'gemini-2.5-flash' : settings.model;
  modelInput.placeholder = config.defaultModel;
  providerUrlInput.placeholder = config.defaultBaseUrl;
  maxChunkInput.value = String(settings.maxChunkTokens);
  temperatureInput.value = String(settings.temperature);
  onProviderChange();
}

/** @param {boolean} hasKey */
function updateKeySavedUi(hasKey) {
  keySavedEl.hidden = !hasKey;
  apiKeyInput.placeholder = hasKey ? 'Enter new key to replace' : 'Paste API key';
}

function readSettings() {
  const providerId = providerIdSelect.value;
  const config = getProviderConfig(providerId);
  const model = modelInput.value.trim() || config.defaultModel;
  return {
    providerId,
    providerUrl: providerUrlInput.value.trim() || config.defaultBaseUrl,
    model: model === 'gemini-2.0-flash' ? 'gemini-2.5-flash' : model,
    language: languageSelect.value || 'en',
    maxChunkTokens: Number(maxChunkInput.value) || 3000,
    temperature: Number(temperatureInput.value) ?? 0.1,
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
  const settings = readSettings();
  const providerChanged = lastProviderId && lastProviderId !== settings.providerId;

  await chrome.storage.local.set({ [LLM_STORAGE_KEYS.settings]: settings });
  lastProviderId = settings.providerId;

  if (providerChanged) {
    showStatus('Provider saved. Replace your API key if the previous one was for another provider.');
    return;
  }
  showStatus('Provider settings saved');
}

async function testConnection() {
  const consent = await getConsentState();
  if (!consent.given) {
    showStatus('Accept privacy consent in the side panel before testing the API.', true);
    return;
  }

  const settings = readSettings();
  const isLocal = settings.providerId === 'chrome';
  const typedKey = apiKeyInput.value.trim();
  const stored = await chrome.storage.local.get(LLM_STORAGE_KEYS.apiKey);
  const apiKey = typedKey || stored[LLM_STORAGE_KEYS.apiKey] || '';

  if (!isLocal && !apiKey) {
    showStatus('Enter or save an API key first', true);
    return;
  }

  if (!isLocal) {
    const permOk = await ensureProviderHostPermission(settings.providerId);
    if (!permOk) {
      showStatus('Network access to the AI provider was denied.', true);
      return;
    }
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
  showStatus('Consent withdrawn. No page text will be sent to your AI provider until you accept again.');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
