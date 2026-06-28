const CURRENT_CONSENT_VERSION = '1';

const STORAGE_KEYS = {
  consentGiven: 'consentGiven',
  consentVersion: 'consentVersion',
};

/** Plain-English disclosure shown on consent screen and options page */
const CONSENT_DISCLOSURE_ITEMS = [
  'Detected legal-document text from this page is sent to Google\'s Gemini API to analyze.',
  'Nothing is sent until you accept; results are kept only in a local cache on your device.',
  'This is a summary, not legal advice.',
];

/**
 * @returns {Promise<boolean>}
 */
async function hasConsent() {
  const result = await chrome.storage.local.get([
    STORAGE_KEYS.consentGiven,
    STORAGE_KEYS.consentVersion,
  ]);
  return (
    result[STORAGE_KEYS.consentGiven] === true &&
    result[STORAGE_KEYS.consentVersion] === CURRENT_CONSENT_VERSION
  );
}

/**
 * @returns {Promise<{ given: boolean; version: string | null; needsConsent: boolean }>}
 */
async function getConsentState() {
  const result = await chrome.storage.local.get([
    STORAGE_KEYS.consentGiven,
    STORAGE_KEYS.consentVersion,
  ]);
  const given =
    result[STORAGE_KEYS.consentGiven] === true &&
    result[STORAGE_KEYS.consentVersion] === CURRENT_CONSENT_VERSION;
  return {
    given,
    version: result[STORAGE_KEYS.consentVersion] ?? null,
    needsConsent: !given,
  };
}

async function grantConsent() {
  await chrome.storage.local.set({
    [STORAGE_KEYS.consentGiven]: true,
    [STORAGE_KEYS.consentVersion]: CURRENT_CONSENT_VERSION,
  });
}

async function withdrawConsent() {
  await chrome.storage.local.set({ [STORAGE_KEYS.consentGiven]: false });
}
