importScripts(
  '../lib/types.js',
  '../lib/storage.js',
  '../lib/messaging.js',
  '../lib/extract-html.js',
  '../lib/fetch-policy.js',
  '../lib/llm/prompts.js',
  '../lib/llm/chunker.js',
  '../lib/llm/client.js',
  '../lib/llm/map-reduce.js',
  '../lib/analyze.js',
);

const CONTENT_SCRIPTS = [
  'lib/extract-html.js',
  'content/detector.js',
  'content/extractor.js',
  'content/content-script.js',
];

/** @type {{ tabId: number; controller: AbortController } | null} */
let activeJob = null;

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SUMMARIZE_TAB') {
    handleSummarize(message.tabId)
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ error: err.message ?? 'Summarization failed' }));
    return true;
  }

  if (message.type === 'GET_TAB_SUMMARY') {
    getTabSummary(message.tabId).then((cached) => sendResponse({ cached }));
    return true;
  }

  if (message.type === 'GET_SETTINGS') {
    Promise.all([getApiKey(), getSettings(), isPrivacyAcknowledged()]).then(
      ([apiKey, settings, privacyAcknowledged]) => {
        sendResponse({ hasApiKey: Boolean(apiKey), settings, privacyAcknowledged });
      },
    );
    return true;
  }

  if (message.type === 'ACK_PRIVACY') {
    setPrivacyAcknowledged().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === 'CANCEL_JOB') {
    if (activeJob?.tabId === message.tabId) {
      activeJob.controller.abort();
      activeJob = null;
    }
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === 'TEST_CONNECTION' || message.type === 'VALIDATE_API_KEY') {
    testConnection(message.apiKey, message.settings)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
});

/** @param {number} tabId */
async function handleSummarize(tabId) {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error('No API key configured. Open Settings to add one.');
  }

  if (activeJob?.tabId === tabId) {
    activeJob.controller.abort();
  }

  const controller = new AbortController();
  activeJob = { tabId, controller };

  try {
    broadcastProgress(tabId, { phase: 'detecting', current: 0, total: 1 });
    const doc = await extractFromTab(tabId);
    const settings = await getSettings();

    const summary = await analyze(
      doc,
      apiKey,
      settings,
      (progress) => broadcastProgress(tabId, progress),
      controller.signal,
    );

    const result = { doc, summary };
    await setTabSummary(tabId, result);
    broadcastComplete(tabId, summary, doc);
    return result;
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error('Cancelled');
    }
    throw err;
  } finally {
    if (activeJob?.tabId === tabId) {
      activeJob = null;
    }
  }
}

/** @param {number} tabId */
async function extractFromTab(tabId) {
  await injectContentScripts(tabId);

  const response = await chrome.tabs.sendMessage(tabId, { type: 'DETECT_AND_EXTRACT' });
  if (response?.error) {
    throw new Error(response.error);
  }

  if (response.needsFetch && response.policyUrl) {
    broadcastProgress(tabId, { phase: 'fetching', current: 0, total: 1 });

    const meta = {
      docType: response.docType,
      confidence: response.confidence,
      originalUrl: response.originalUrl,
      linkLabel: response.linkLabel,
    };

    const fromPage = await chrome.tabs.sendMessage(tabId, {
      type: 'EXTRACT_POLICY_URL',
      url: response.policyUrl,
      meta,
    });

    if (fromPage?.error) {
      throw new Error(fromPage.error);
    }
    if (fromPage?.text) {
      return fromPage;
    }

    return extractFromUrl(response.policyUrl, meta);
  }

  if (!response?.text?.trim()) {
    throw new Error('No readable text found on this page.');
  }
  return response;
}

/** @param {number} tabId */
async function injectContentScripts(tabId) {
  const [result] = await chrome.scripting
    .executeScript({
      target: { tabId },
      func: () => Boolean(globalThis.__didntReadInjected),
    })
    .catch(() => [null]);

  if (result?.result) {
    return;
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: CONTENT_SCRIPTS,
  });
}
