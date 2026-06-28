/** Host permission helpers — call only from extension page click handlers (side panel, options). */
(function () {
  const GEMINI_ORIGIN = 'https://generativelanguage.googleapis.com/*';

  /**
   * Prompt for Gemini API access while the user gesture is still active.
   * @returns {Promise<boolean>}
   */
  globalThis.ensureGeminiHostPermission = async function ensureGeminiHostPermission() {
    const origins = [GEMINI_ORIGIN];
    if (await chrome.permissions.contains({ origins })) {
      return true;
    }
    return chrome.permissions.request({ origins });
  };

  /**
   * @param {string} url
   * @returns {Promise<boolean>}
   */
  globalThis.ensureOriginHostPermission = async function ensureOriginHostPermission(url) {
    let originPattern;
    try {
      originPattern = new URL(url).origin + '/*';
    } catch {
      return false;
    }
    if (await chrome.permissions.contains({ origins: [originPattern] })) {
      return true;
    }
    return chrome.permissions.request({ origins: [originPattern] });
  };
})();
