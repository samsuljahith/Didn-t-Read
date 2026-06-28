const CONTENT_SCRIPTS = [
  'lib/extract-html.js',
  'content/detector.js',
  'content/extractor.js',
  'content/content-script.js',
];

/** @type {{ tabId: number; controller: AbortController } | null} */
let activeJob = null;

/** Ensure toolbar click opens the side panel or Firefox sidebar. */
function configureSidePanel() {
  if (!isFirefox && chrome.sidePanel) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
  }
}

configureSidePanel();

chrome.runtime.onInstalled.addListener(() => {
  configureSidePanel();
});

const toolbarAction = isFirefox ? extApi.browserAction : extApi.action;
toolbarAction.onClicked.addListener(async (tab) => {
  try {
    if (!isFirefox && chrome.sidePanel) {
      if (tab.id !== undefined) {
        await chrome.sidePanel.open({ tabId: tab.id });
        return;
      }
      if (tab.windowId !== undefined) {
        await chrome.sidePanel.open({ windowId: tab.windowId });
      }
      return;
    }
    if (isFirefox && extApi.sidebarAction?.open) {
      await extApi.sidebarAction.open();
    }
  } catch (err) {
    console.error("[Didn't Read] Failed to open panel:", err);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXTRACTION_PROGRESS' && sender.tab?.id != null) {
    broadcastProgress(sender.tab.id, { phase: 'extracting', current: 0, total: 1 });
    return false;
  }

  if (message.type === 'SUMMARIZE_TAB') {
    handleSummarize(message.tabId, { force: Boolean(message.force) })
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ error: err.message ?? 'Summarization failed' }));
    return true;
  }

  if (message.type === 'GET_TAB_SUMMARY') {
    getTabSummary(message.tabId).then((cached) => sendResponse({ cached }));
    return true;
  }

  if (message.type === 'DETECT_TAB') {
    handleDetectTab(message.tabId)
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ detected: false, error: err.message }));
    return true;
  }

  if (message.type === 'SAVE_API_KEY') {
    setApiKey(message.apiKey)
      .then(() =>
        chrome.storage.local.set({ setupComplete: true }).then(() => sendResponse({ ok: true })),
      )
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  if (message.type === 'SAVE_SETTINGS') {
    setSettings(message.settings)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  if (message.type === 'GET_SETTINGS') {
    Promise.all([getApiKey(), getSettings(), getConsentState()]).then(
      ([apiKey, settings, consent]) => {
        sendResponse({
          hasApiKey: Boolean(apiKey),
          settings,
          consentGiven: consent.given,
          consentNeedsPrompt: consent.needsConsent,
          consentVersion: consent.version,
          isFirefox,
        });
      },
    );
    return true;
  }

  if (message.type === 'GRANT_CONSENT') {
    grantConsent().then(() => sendResponse({ ok: true, consentGiven: true }));
    return true;
  }

  if (message.type === 'WITHDRAW_CONSENT') {
    withdrawConsent().then(() => sendResponse({ ok: true, consentGiven: false }));
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
    hasConsent()
      .then((ok) => {
        if (!ok) {
          sendResponse({
            error: 'Accept the privacy consent in the side panel before testing the API.',
          });
          return;
        }
        return testConnection(message.apiKey, message.settings).then(() =>
          sendResponse({ ok: true }),
        );
      })
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
});

/** @param {number} tabId @param {{ force?: boolean }} [options] */
async function handleSummarize(tabId, options = {}) {
  const force = options.force ?? false;

  if (!(await hasConsent())) {
    broadcastConsentRequired(tabId, { force });
    return { consentRequired: true };
  }

  const settings = await getSettings();
  if (settings.providerId !== 'chrome') {
    const apiKey = await getApiKey();
    if (!apiKey) {
      throw new Error('No API key configured. Open Settings to add one.');
    }
  }

  if (activeJob?.tabId === tabId) {
    activeJob.controller.abort();
  }

  const controller = new AbortController();
  activeJob = { tabId, controller };

  try {
    broadcastProgress(tabId, { phase: 'detecting', current: 0, total: 1 });
    const doc = await extractFromTab(tabId);

    if (doc.notLegal) {
      return {
        notLegal: true,
        reason: doc.reason,
        docType: doc.docType,
        confidence: doc.confidence ?? 0,
      };
    }

    const textHash = await hashText(doc.text);

    let summary;
    let fromCache = false;

    if (!force) {
      const cached = await getAnalysisCache(textHash, settings);
      if (cached) {
        logCacheEvent(textHash, 'hit');
        summary = cached;
        fromCache = true;
      } else {
        logCacheEvent(textHash, 'miss');
      }
    } else {
      logCacheEvent(textHash, 'bypass');
    }

    if (!summary) {
      if (!(await hasConsent())) {
        broadcastConsentRequired(tabId, { force });
        return { consentRequired: true };
      }
      summary = await analyze(
        doc,
        settings,
        (progress) => broadcastProgress(tabId, progress),
        controller.signal,
      );
      await setAnalysisCache(textHash, settings, summary);
    }

    const result = {
      doc,
      summary,
      fromCache,
      priorityGrounding: getPriorityGroundingFlags(summary.priorities, doc.text),
    };
    await setTabSummary(tabId, result);
    broadcastComplete(tabId, summary, doc, { priorityGrounding: result.priorityGrounding });
    return result;
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error('Cancelled');
    }
    if (err?.code === 'NEEDS_ORIGIN_PERMISSION' && err.policyUrl) {
      return {
        needsOriginPermission: {
          policyUrl: err.policyUrl,
          origin: new URL(err.policyUrl).origin,
        },
      };
    }
    throw err;
  } finally {
    if (activeJob?.tabId === tabId) {
      activeJob = null;
    }
  }
}

/** @param {number} tabId */
async function handleDetectTab(tabId) {
  await injectContentScripts(tabId);
  const response = await chrome.tabs.sendMessage(tabId, { type: 'DETECT_AND_EXTRACT' });

  if (response?.error) {
    return { detected: false, error: response.error };
  }

  if (response.isLegal === false) {
    return {
      detected: false,
      notLegal: true,
      reason: response.blockReason ?? 'not_a_legal_page',
      docType: response.docType,
      confidence: response.confidence ?? 0,
    };
  }

  if (response.needsFetch && response.policyUrl) {
    return {
      detected: true,
      docType: response.docType ?? 'unknown',
      confidence: response.confidence ?? 0,
      mode: 'hub',
      linkLabel: response.linkLabel,
      policyUrl: response.policyUrl,
    };
  }

  if (response?.text?.trim()) {
    return {
      detected: true,
      docType: response.docType ?? 'unknown',
      confidence: response.confidence ?? 0,
      mode: response.mode ?? 'document',
      wordCount: response.wordCount ?? 0,
      title: response.title,
    };
  }

  return { detected: false };
}

/** @param {number} tabId */
async function extractFromTab(tabId) {
  await injectContentScripts(tabId);
  broadcastProgress(tabId, { phase: 'extracting', current: 0, total: 1 });

  const response = await chrome.tabs.sendMessage(tabId, { type: 'DETECT_AND_EXTRACT' });
  if (response?.error) {
    throw new Error(response.error);
  }

  if (response.isLegal === false) {
    const reason = response.blockReason ?? 'not_a_legal_page';
    return {
      notLegal: true,
      reason,
      docType: response.docType,
      confidence: response.confidence ?? 0,
    };
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
  if (isFirefox) {
    try {
      const [injected] = await extApi.tabs.executeScript(tabId, {
        code: 'Boolean(globalThis.__didntReadInjected)',
        runAt: 'document_idle',
      });
      if (injected) {
        return;
      }
    } catch {
      // continue to inject
    }

    for (const file of CONTENT_SCRIPTS) {
      await extApi.tabs.executeScript(tabId, { file, runAt: 'document_idle' });
    }
    return;
  }

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
