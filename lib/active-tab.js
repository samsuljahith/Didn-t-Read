/**
 * Pure helper for side-panel tab sync (unit-tested).
 * @param {number | null} storedTabId
 * @param {number | null} activeTabId
 * @param {string | null | undefined} storedUrl
 * @param {string | null | undefined} activeUrl
 */
globalThis.resolveTabForSidePanel = function resolveTabForSidePanel(
  storedTabId,
  activeTabId,
  storedUrl,
  activeUrl,
) {
  if (activeTabId == null) {
    return { tabId: storedTabId, pageUrl: storedUrl ?? null, changed: false };
  }
  const changed = storedTabId !== activeTabId || storedUrl !== activeUrl;
  return {
    tabId: activeTabId,
    pageUrl: activeUrl ?? null,
    changed,
  };
};
