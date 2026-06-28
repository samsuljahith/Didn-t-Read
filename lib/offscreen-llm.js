const OFFSCREEN_PATH = 'offscreen/offscreen.html';

/**
 * @returns {Promise<void>}
 */
async function ensureOffscreenDocument() {
  const url = chrome.runtime.getURL(OFFSCREEN_PATH);
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [url],
  });

  if (contexts.length > 0) {
    return;
  }

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_PATH,
    reasons: ['DOM_PARSER'],
    justification: 'Run Chrome on-device language model for local-only summarization',
  });
}

/**
 * @param {{ system: string; user: string }} prompt
 * @param {AbortSignal} [signal]
 * @returns {Promise<string>}
 */
async function promptLocalLlm(prompt, signal) {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  await ensureOffscreenDocument();

  const response = await chrome.runtime.sendMessage({
    target: 'offscreen',
    type: 'LOCAL_LLM_PROMPT',
    prompt,
  });

  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  if (response?.error) {
    throw new Error(response.error);
  }

  return response.text;
}

/**
 * @returns {Promise<void>}
 */
async function testLocalLlm() {
  await ensureOffscreenDocument();
  const response = await chrome.runtime.sendMessage({
    target: 'offscreen',
    type: 'LOCAL_LLM_TEST',
  });
  if (response?.error) {
    throw new Error(response.error);
  }
}
