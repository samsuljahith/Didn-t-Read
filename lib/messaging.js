/** @typedef {import('./types.js').JobProgress} JobProgress */

/**
 * @param {number} tabId
 * @param {JobProgress} progress
 */
function broadcastProgress(tabId, progress) {
  chrome.runtime.sendMessage({
    type: 'JOB_PROGRESS',
    tabId,
    progress,
  }).catch(() => {});
}

/**
 * @param {number} tabId
 * @param {string} message
 * @param {string} [code]
 */
function broadcastError(tabId, message, code) {
  chrome.runtime.sendMessage({
    type: 'JOB_ERROR',
    tabId,
    error: { message, code },
  }).catch(() => {});
}

/**
 * @param {number} tabId
 * @param {import('./types.js').StructuredSummary} summary
 * @param {import('./types.js').ExtractedDoc} doc
 * @param {{ priorityGrounding?: Record<string, boolean> }} [meta]
 */
function broadcastComplete(tabId, summary, doc, meta = {}) {
  chrome.runtime.sendMessage({
    type: 'JOB_COMPLETE',
    tabId,
    summary,
    doc,
    priorityGrounding: meta.priorityGrounding,
  }).catch(() => {});
}

/**
 * @param {number} tabId
 * @param {{ force?: boolean }} [options]
 */
function broadcastConsentRequired(tabId, options = {}) {
  chrome.runtime.sendMessage({
    type: 'CONSENT_REQUIRED',
    tabId,
    force: Boolean(options.force),
  }).catch(() => {});
}

/**
 * @param {number} tabId
 * @param {string} url
 */
function broadcastTabContextChanged(tabId, url) {
  chrome.runtime.sendMessage({
    type: 'TAB_CONTEXT_CHANGED',
    tabId,
    url,
  }).catch(() => {});
}
