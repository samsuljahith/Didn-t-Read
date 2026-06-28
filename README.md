# Didn't Read

Chrome MV3 extension that detects legal documents on the current page (T&C, privacy, cookie policies), extracts text, summarizes via your LLM API key, and renders a structured summary in the side panel.

## Load unpacked

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select this folder
4. Open **Settings** and add your API key (OpenAI-compatible endpoint)
5. Click the toolbar icon to open the side panel, then **Summarize this page**

Click the extension icon first so `activeTab` permission is granted for the current tab.

## Structure

```
manifest.json
background/service-worker.js   # Orchestration, LLM calls, job lifecycle
content/
  detector.js                  # scoreLegalDoc(), hub vs document, policy links
  extractor.js                 # Thin wrapper around shared extractor
  content-script.js            # Detection + extraction message handler
lib/
  analyze.js                   # Summarize pipeline entry
  extract-html.js              # Readability-style extraction (page + fetched HTML)
  fetch-policy.js              # Service worker: fetch linked policy URLs
  messaging.js                 # Progress/complete broadcasts
  storage.js                   # API key + session cache
  types.js                     # Shared JSDoc types
  llm/
    client.js                  # OpenAI-compatible fetch client
    prompts.js                 # Full / chunk / merge prompts
    chunker.js                 # Token-aware splitting
    map-reduce.js              # Map + hierarchical reduce
sidepanel/                     # Side panel UI
options/                       # API key + model settings
icons/
```

## Long documents

Documents over ~3,000 words are split into overlapping chunks, summarized in parallel (up to 3 concurrent), then merged via a reduce pass. Very large merge inputs use hierarchical batching.

## Permissions

| Permission | Purpose |
|------------|---------|
| `activeTab` | Inject content script on user action |
| `scripting` | Programmatic content script injection |
| `sidePanel` | Summary UI |
| `storage` | API key (local) + per-tab cache (session) |
| `optional_host_permissions` | Requested at runtime for your LLM provider origin |

## Security

API keys are stored in `chrome.storage.local` on your machine. They are sent only to the LLM provider you configure. Anyone with access to this computer can inspect extension storage.
