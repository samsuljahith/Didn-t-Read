(function () {
  const CONSENT_STORAGE_KEYS = {
    consentGiven: 'consentGiven',
    consentVersion: 'consentVersion',
  };

  /** Plain-English disclosure shown on consent screen and options page */
  globalThis.CONSENT_DISCLOSURE_ITEMS = [
    'Detected legal-document text from this page is sent to your chosen AI provider when you summarize.',
    'Nothing is sent until you accept; results are kept only in a local cache on your device.',
    'Your API key is stored locally on this device and sent only to the active provider.',
    'This is a summary, not legal advice.',
  ];

  globalThis.CURRENT_CONSENT_VERSION = '1';

  /**
   * @returns {Promise<boolean>}
   */
  globalThis.hasConsent = async function hasConsent() {
    const result = await chrome.storage.local.get([
      CONSENT_STORAGE_KEYS.consentGiven,
      CONSENT_STORAGE_KEYS.consentVersion,
    ]);
    return (
      result[CONSENT_STORAGE_KEYS.consentGiven] === true &&
      result[CONSENT_STORAGE_KEYS.consentVersion] === globalThis.CURRENT_CONSENT_VERSION
    );
  };

  /**
   * @returns {Promise<{ given: boolean; version: string | null; needsConsent: boolean }>}
   */
  globalThis.getConsentState = async function getConsentState() {
    const result = await chrome.storage.local.get([
      CONSENT_STORAGE_KEYS.consentGiven,
      CONSENT_STORAGE_KEYS.consentVersion,
    ]);
    const given =
      result[CONSENT_STORAGE_KEYS.consentGiven] === true &&
      result[CONSENT_STORAGE_KEYS.consentVersion] === globalThis.CURRENT_CONSENT_VERSION;
    return {
      given,
      version: result[CONSENT_STORAGE_KEYS.consentVersion] ?? null,
      needsConsent: !given,
    };
  };

  globalThis.grantConsent = async function grantConsent() {
    await chrome.storage.local.set({
      [CONSENT_STORAGE_KEYS.consentGiven]: true,
      [CONSENT_STORAGE_KEYS.consentVersion]: globalThis.CURRENT_CONSENT_VERSION,
    });
  };

  globalThis.withdrawConsent = async function withdrawConsent() {
    await chrome.storage.local.set({ [CONSENT_STORAGE_KEYS.consentGiven]: false });
  };
})();
