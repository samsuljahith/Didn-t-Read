<p align="center">
  <img src="icons/icon128.png" alt="Didn't Read logo" width="128" height="128" />
</p>

# Didn't Read

**Understand any Terms of Service, Privacy Policy, or Cookie Policy in seconds — not minutes.**

Didn't Read is a Chromium browser extension that detects legal documents on the page you're viewing, analyzes them with your chosen AI provider, and presents a concise, structured summary in a side panel — including your top privacy concerns first and an explainable risk score where every point is tied to the exact clause that triggered it.

The logo is a minimalist document frame with a teal checkmark — purple (`#2E1A68`) and teal (`#1ABC9C`) signal clarity and “verified at a glance.”

---

## How it's different

Most policy-summary tools take one of two approaches, and both have a real weakness:

- **Human-reviewed databases** are accurate, but summaries can be months or years out of date, and smaller or brand-new sites often have no review at all.
- **Single-grade AI tools** give you one overall letter or number with little explanation of *why*.

Didn't Read takes a different path:

- It analyzes the **actual policy text on the page in front of you** — so it's never stale, and it works on any site, including niche, local, and just-launched ones.
- It answers **six questions you care about first** — data selling, advertising use, third-party sharing, refunds, cancellation, and payment terms — before anything else.
- Every point in the risk score is **grounded in a specific clause** from the document, with the verbatim text one click away — so you can check the AI's reasoning against the source instead of trusting a black box.

---

## Features

- **Automatic detection** of Terms & Conditions, Privacy Policies, and Cookie Policies — whether the page *is* a policy or just links to one. Non-legal pages (blogs, product listings, etc.) are blocked before any text is sent for analysis.
- **Clean extraction** of the legal text, stripping navigation, footers, and ads.
- **Your choice of AI provider** — Google Gemini, OpenAI, Anthropic Claude, or xAI Grok — with one API key stored locally at a time.
- **Top-priority answers first** — six plain-language cards (yes / no / unclear) for data selling, advertising, third-party sharing, refunds, cancellation, and payment terms.
- **Explainable, clause-grounded risk score**: an overall value (0–100) and label (low / medium / high), with a visual risk meter, severity breakdown, and expandable factors — each with the verbatim clause, category, severity, and a plain-English reason.
- **Structured summary** covering key points, risky clauses, data collection, third-party sharing, subscription terms, cancellation & refunds, user obligations, and important legal clauses.
- **Multi-language UI and output** — English, Chinese, Malay, and Tamil (Singapore-focused).
- **Friendly first-run setup** — a 3-step side-panel flow to get a free API key, paste it, and connect in about 30 seconds. Detection still works before setup; the prompt appears when you try to summarize.
- **Privacy consent gate**: nothing is sent to your AI provider until you explicitly accept a clear disclosure. Consent is versioned; you can withdraw it any time from Settings.
- **Local caching**: revisiting an already-analyzed page returns the result instantly without a new AI call. **Re-analyze** forces a fresh pass.

---

## Install (unpacked)

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome (or any Chromium browser — Edge, Brave, Arc).
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the extension folder.
5. The Didn't Read icon appears in your toolbar.

## Setup

1. Visit a page with a privacy policy or terms of service — you'll see **policy detected** in the side panel even before setup.
2. Click **Summarize** — if you don't have a key yet, follow the 3-step setup: get a free key from your provider, paste it, and click **Connect**.
3. Accept the privacy disclosure the first time you analyze.
4. For more control, open **Settings** (toolbar icon → Options) to switch provider, model, or language.

## Usage

1. Visit any page containing a Terms, Privacy, or Cookie policy (or a hub page that links to one).
2. Open the side panel (click the toolbar icon).
3. Click **Summarize**.
4. Read your top six concerns, then the risk meter and breakdown; click **View clause** on any factor to see the exact source text.
5. Use **Re-analyze** to bypass the cache and run a fresh analysis.

---

## Privacy

Didn't Read is built for a privacy-conscious audience, so it's direct about what it does:

- When you choose to analyze a page, **detected legal-document text from that page is sent to your chosen AI provider** for analysis. Nothing is sent until you accept the disclosure.
- Analysis results are stored only in a **local cache on your device**. The extension adds no telemetry and no analytics.
- Your API key is stored locally in browser storage and is sent only to the active provider when you summarize or test the connection.

If you need a tool that performs *all* processing locally with no external API, Didn't Read is not that tool — and it says so up front.

---

## Known limitations

Named honestly, because a tool you can trust is one that tells you its edges:

- **Not legal advice.** AI can misread complex legal language. The verbatim clauses exist so you can verify claims against the source — treat the summary as a fast starting point, not a legal opinion.
- **Performance on large documents.** Page extraction runs on the tab's rendering thread, so a very large document may briefly lag the page. The AI call runs in the background and does not block the page.
- **Cached revisits still re-read the page.** On a revisit, the extension re-extracts the page text before checking the cache — only the AI call is skipped, not the extraction.
- **Chromium only.** Works in Chrome, Edge, Brave, and Arc. It is not built for Firefox or Safari.
- **Client-side key storage.** Your key lives in the browser, which is fine for personal use — but a client-side key is extractable by anyone with device access. There is no backend proxy in this project.

---

## How it works

```
Visited page
   │
   ├─ Content script  → scores legal doc; extracts clean text
   │                     (hub pages fetch the linked policy instead)
   │                     non-legal pages stop here — no text sent upstream
   │
   └─ Service worker  → checks consent → checks local cache
                        → on cache miss, routes to active provider
                          (Gemini / OpenAI / Anthropic / Grok)
                        → validates & normalizes structured JSON
   │
Side panel  → priorities → risk meter → breakdown → summary sections
              (UI + LLM output in your chosen language)
```

All AI work runs in the **service worker**, off the visited page's main thread. Consent is checked before any provider call, including the connection test.

## Tech stack

- **Manifest V3** (service worker, content script, side panel, options page)
- **Provider-agnostic LLM layer** with structured JSON output; default models include Gemini 2.5 Flash, GPT-4o mini, Claude Sonnet, and Grok 2
- Vanilla JavaScript, no build step required

---

## Disclaimer

Didn't Read provides automated summaries of legal documents for convenience and general understanding. It is **not** a substitute for professional legal advice. Always read the original document and consult a qualified professional for decisions with legal or financial consequences.
