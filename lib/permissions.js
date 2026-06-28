/** Host permission helpers — call only from extension page click handlers (side panel, options). */
(function () {
  const PROVIDER_ORIGINS = {
    gemini: 'https://generativelanguage.googleapis.com/*',
    openai: 'https://api.openai.com/*',
    anthropic: 'https://api.anthropic.com/*',
    grok: 'https://api.x.ai/*',
  };

  /**
   * @param {'gemini' | 'openai' | 'anthropic' | 'grok' | string} [providerId]
   * @returns {Promise<boolean>}
   */
  globalThis.ensureProviderHostPermission = async function ensureProviderHostPermission(
    providerId = 'gemini',
  ) {
    const origin = PROVIDER_ORIGINS[providerId] ?? PROVIDER_ORIGINS.gemini;
    if (await chrome.permissions.contains({ origins: [origin] })) {
      return true;
    }
    return chrome.permissions.request({ origins: [origin] });
  };

  /** @deprecated Use ensureProviderHostPermission */
  globalThis.ensureGeminiHostPermission = async function ensureGeminiHostPermission() {
    return ensureProviderHostPermission('gemini');
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
