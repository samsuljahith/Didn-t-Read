# Didn't Read

A Chrome extension that finds legal documents on the page you're viewing—privacy policies, terms of service, cookie notices—extracts the text, and summarizes it in plain English in a side panel. You bring your own LLM API key; nothing runs on our servers.

## What it does

1. **Detect** — Scores the page (URL, headings, link text, legal phrasing) to tell a full policy apart from a hub page that only links to one.
2. **Extract** — Pulls main content with a Readability-style pass (strips nav, footer, ads). Hub pages can follow same-origin policy links automatically.
3. **Analyze** — Sends text to **Google Gemini** (`generateContent` with structured JSON output) and renders a structured summary: plain-language overview, risk score, key points, data collection, risky clauses, and more.
4. **Cache** — Reuses analysis when the same extracted text is seen again (hash keyed in `chrome.storage.local`). Use **Re-analyze** to force a fresh LLM call.

Open the side panel from the toolbar icon, then click **Summarize this page**. Click the extension icon on the tab first so `activeTab` access is granted.

## Install (unpacked)

1. Clone or download this repository.
2. Open **`chrome://extensions`** in Chrome.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select this project folder (`Didn-t-Read`).
5. Pin the extension if you like—it appears as **Didn't Read**.

## Setup: add your own API key

1. Click the extension icon → open the side panel → **Settings**,  
   or right-click the extension → **Options**.
2. Paste your API key under **Enter or replace API key** → **Save key**.  
   The key is masked after save (shown as `••••••••••••`).
3. Set **Provider URL** (default `https://generativelanguage.googleapis.com/v1beta`) and **Model** (default `gemini-2.0-flash`).
4. Click **Test connection** to verify your [Gemini API key](https://aistudio.google.com/apikey) and grant network access.
5. Return to a legal page, open the side panel, and click **Summarize this page**.

Keys are stored in **`chrome.storage.local`** on your device only. The extension never logs your API key.

## Privacy & data handling

- **Page content** — When you summarize, extracted text from the current page (or a linked same-origin policy) is sent **directly to the LLM provider you configure**. It is not sent to us or any intermediate server.
- **First-run notice** — The side panel shows a disclosure on first use; dismiss with **Got it**.
- **API key storage** — Keys live in `chrome.storage.local` on this browser. Anyone with access to your computer can inspect extension storage (DevTools → Application → Extension storage). Do not use on shared machines without understanding that risk.
- **Analysis cache** — Summaries are cached locally by hash of extracted text so repeat visits avoid another LLM call. Clear by using **Re-analyze** or removing extension data in Chrome settings.

Review sensitive pages before summarizing—you are choosing to send that text to your LLM provider.

## Development

```bash
npm install
npm test      # unit tests (scoreLegalDoc)
npm run lint  # syntax-check extension scripts
```

After code changes, click **Reload** on `chrome://extensions`.

## Permissions

| Permission | Why |
|------------|-----|
| `activeTab` | Read the current tab when you invoke the extension |
| `scripting` | Inject the content script on demand |
| `sidePanel` | Summary UI |
| `storage` | API key, analysis cache, settings |
| `optional_host_permissions` (`https://generativelanguage.googleapis.com/*`) | Gemini API (requested on test/summarize) |

## Project layout

```
manifest.json
background/service-worker.js
content/detector.js          # scoreLegalDoc()
content/extractor.js
content/content-script.js
lib/                         # extraction, LLM pipeline, cache
sidepanel/                   # UI
options/                     # API key & provider settings
test/                        # unit tests
```

## Long documents

Most policies fit in one Gemini call (under ~90k estimated input tokens). Longer documents are chunked, summarized in parallel, then merged. Progress appears in the side panel during chunking.
