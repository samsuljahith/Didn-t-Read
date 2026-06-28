const form = document.getElementById('settings-form');
const apiKeyInput = document.getElementById('api-key');
const providerUrlInput = document.getElementById('provider-url');
const modelInput = document.getElementById('model');
const maxChunkInput = document.getElementById('max-chunk-tokens');
const temperatureInput = document.getElementById('temperature');
const validateBtn = document.getElementById('validate-btn');
const clearKeyBtn = document.getElementById('clear-key-btn');
const saveStatus = document.getElementById('save-status');

const STORAGE_KEYS = {
  apiKey: 'llmApiKey',
  settings: 'llmSettings',
};

const DEFAULTS = {
  providerUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  maxChunkTokens: 3000,
  temperature: 0.2,
};

loadSettings();

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  await saveSettings(false);
});

validateBtn.addEventListener('click', async () => {
  await saveSettings(true);
});

clearKeyBtn.addEventListener('click', async () => {
  await chrome.storage.local.remove(STORAGE_KEYS.apiKey);
  apiKeyInput.value = '';
  apiKeyInput.placeholder = 'sk-…';
  showStatus('API key cleared');
});

async function loadSettings() {
  const result = await chrome.storage.local.get([STORAGE_KEYS.apiKey, STORAGE_KEYS.settings]);
  const settings = { ...DEFAULTS, ...result[STORAGE_KEYS.settings] };

  if (result[STORAGE_KEYS.apiKey]) {
    apiKeyInput.placeholder = '•••••••• (saved)';
  }
  providerUrlInput.value = settings.providerUrl;
  modelInput.value = settings.model;
  maxChunkInput.value = String(settings.maxChunkTokens);
  temperatureInput.value = String(settings.temperature);
}

function readSettings() {
  return {
    providerUrl: providerUrlInput.value.trim() || DEFAULTS.providerUrl,
    model: modelInput.value.trim() || DEFAULTS.model,
    maxChunkTokens: Number(maxChunkInput.value) || DEFAULTS.maxChunkTokens,
    temperature: Number(temperatureInput.value) ?? DEFAULTS.temperature,
  };
}

/** @param {boolean} validate */
async function saveSettings(validate) {
  const settings = readSettings();
  const updates = { [STORAGE_KEYS.settings]: settings };

  const apiKey = apiKeyInput.value.trim();
  let keyToValidate = apiKey;

  if (apiKey) {
    updates[STORAGE_KEYS.apiKey] = apiKey;
  } else {
    const stored = await chrome.storage.local.get(STORAGE_KEYS.apiKey);
    keyToValidate = stored[STORAGE_KEYS.apiKey] ?? '';
  }

  if (validate) {
    if (!keyToValidate) {
      showStatus('Enter or save an API key first', true);
      return;
    }
    showStatus('Validating…');
    const result = await chrome.runtime.sendMessage({
      type: 'VALIDATE_API_KEY',
      apiKey: keyToValidate,
      settings,
    });
    if (result?.error) {
      showStatus(result.error, true);
      return;
    }
    showStatus('API key is valid');
  }

  await chrome.storage.local.set(updates);

  if (apiKey) {
    apiKeyInput.value = '';
    apiKeyInput.placeholder = '•••••••• (saved)';
  }

  if (!validate) {
    showStatus('Settings saved');
  }
}

function showStatus(text, isError = false) {
  saveStatus.textContent = text;
  saveStatus.className = isError ? 'status error' : 'status';
  saveStatus.hidden = false;
}
