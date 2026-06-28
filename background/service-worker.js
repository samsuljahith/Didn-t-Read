/** Scripts shared by the service worker / Firefox background (relative to background/). */
const SW_SCRIPTS = [
  '../lib/browser-compat.js',
  '../lib/llm/provider-config.js',
  '../lib/consent.js',
  '../lib/storage.js',
  '../lib/messaging.js',
  '../lib/extract-html.js',
  '../lib/fetch-policy.js',
  '../lib/analysis-cache.js',
  '../lib/llm/response-schema.js',
  '../lib/llm/validate-summary.js',
  '../lib/grounding.js',
  '../lib/offscreen-llm.js',
  '../lib/llm/providers/chrome-local.js',
  '../lib/llm/providers/gemini.js',
  '../lib/llm/providers/openai.js',
  '../lib/llm/providers/anthropic.js',
  '../lib/llm/providers/grok.js',
  '../lib/llm/router.js',
  '../lib/llm/prompts.js',
  '../lib/llm/chunker.js',
  '../lib/llm/map-reduce.js',
  '../lib/analyze.js',
  'background-main.js',
];

// Must run once at top level during service worker evaluation.
importScripts(...SW_SCRIPTS);
