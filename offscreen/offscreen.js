const OFFSCREEN_URL = chrome.runtime.getURL('offscreen/offscreen.html');

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target !== 'offscreen') {
    return false;
  }

  if (message.type === 'LOCAL_LLM_PROMPT') {
    runLocalPrompt(message.prompt)
      .then((text) => sendResponse({ text }))
      .catch((err) => sendResponse({ error: err.message ?? 'On-device AI failed' }));
    return true;
  }

  if (message.type === 'LOCAL_LLM_TEST') {
    testLocalAvailability()
      .then((ok) => sendResponse({ ok }))
      .catch((err) => sendResponse({ error: err.message ?? 'On-device AI unavailable' }));
    return true;
  }

  return false;
});

async function testLocalAvailability() {
  const ai = globalThis.ai ?? globalThis.LanguageModel;
  if (!ai?.languageModel) {
    throw new Error(
      'Chrome on-device AI is not available. Use Chrome 131+ and enable Gemini Nano in chrome://flags or chrome://on-device-internals.',
    );
  }

  const caps = await ai.languageModel.capabilities();
  if (caps.available === 'no') {
    throw new Error('On-device model is not ready yet. Try again after Chrome finishes downloading it.');
  }
  return true;
}

/**
 * @param {{ system: string; user: string }} prompt
 */
async function runLocalPrompt(prompt) {
  await testLocalAvailability();
  const ai = globalThis.ai ?? globalThis.LanguageModel;

  const session = await ai.languageModel.create({
    systemPrompt: prompt.system,
    temperature: 0.1,
  });

  try {
    const text = await session.prompt(prompt.user);
    if (!text?.trim()) {
      throw new Error('On-device model returned an empty response');
    }
    return text;
  } finally {
    if (typeof session.destroy === 'function') {
      session.destroy();
    }
  }
}
