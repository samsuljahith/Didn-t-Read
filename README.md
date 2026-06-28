# DIDN'T-READ

**Understand any Terms of Service, Privacy Policy, or Cookie Policy in seconds — not minutes.**

DIDN'T-READ is a Chromium browser extension that detects legal documents on the page you're viewing, analyzes them with Google Gemini, and presents a concise, structured summary in a side panel — including an explainable risk score where every point is tied to the exact clause that triggered it.

---

## How it's different

Most policy-summary tools take one of two approaches, and both have a real weakness:

- **Human-reviewed databases** are accurate, but summaries can be months or years out of date, and smaller or brand-new sites often have no review at all.
- **Single-grade AI tools** give you one overall letter or number with little explanation of *why*.

DIDN'T-READ takes a different path:

- It analyzes the **actual policy text on the page in front of you** — so it's never stale, and it works on any site, including niche, local, and just-launched ones.
- Every point in the risk score is **grounded in a specific clause** from the document, with the verbatim text one click away — so you can check the AI's reasoning against the source instead of trusting a black box.

---

## Features

- **Automatic detection** of Terms & Conditions, Privacy Policies, and Cookie Policies — whether the page *is* a policy or just links to one.
- **Clean extraction** of the legal text, stripping navigation, footers, and ads.
- **AI analysis via Google Gemini** with schema-constrained JSON output for reliable, structured results.
- **Explainable, clause-grounded risk score**: an overall value (0–100) and label (low / medium / high), broken into factors — each with the verbatim clause, a category, a severity (`normal` / `caution` / `red_flag`), and a plain-English reason it matters.
- **Structured summary** covering key points, risky clauses, data collection, third-party sharing, subscription & auto-renewal terms, cancellation & refund policies, user obligations, important legal clauses, and a plain-English overview anyone can read.
- **Side panel UI** with a color-coded risk badge and an expandable risk breakdown.
- **Privacy consent gate**: nothing is sent to Gemini until you explicitly accept a clear, plain-English disclosure. Consent is versioned, so a future disclosure change re-prompts you, and you can withdraw it any time from Settings.
- **Local caching**: revisiting an already-analyzed page returns the result instantly without a new AI call. A *Re-analyze* button forces a fresh pass.
- **Bring your own API key**: uses your personal Gemini key, stored locally in your browser.

---

## Install (unpacked)

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome (or any Chromium browser — Edge, Brave, Arc).
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the extension folder.
5. The DIDN'T-READ icon appears in your toolbar.

## Setup

1. Get a free Gemini API key from **[Google AI Studio](https://aistudio.google.com/apikey)**.
2. Open the extension's **Settings** (right-click the icon → Options, or open it from the side panel).
3. Paste your key and click **Test connection** to confirm it works.
4. The first time you analyze a page, you'll see a privacy disclosure — accept it to enable analysis.

## Usage

1. Visit any page containing a Terms, Privacy, or Cookie policy.
2. Open the side panel (click the toolbar icon).
3. Click **Summarize**.
4. Read the risk breakdown; click **View clause** on any factor to see the exact source text.
5. Use **Re-analyze** to bypass the cache and run a fresh analysis.

---

## Privacy

DIDN'T-READ is built for a privacy-conscious audience, so it's direct about what it does:

- When you choose to analyze a page, the **detected legal-document text from that page is sent to Google's Gemini API** for analysis. Nothing is sent until you accept the first-run disclosure.
- Analysis results are stored only in a **local cache on your device**. The extension adds no telemetry and no analytics.
- Your API key is stored locally in browser storage and is used only to call Gemini.

If you need a tool that performs *all* processing locally with no external API, DIDN'T-READ is not that tool — and it says so up front.

---

## Known limitations

Named honestly, because a tool you can trust is one that tells you its edges:

- **Not legal advice.** AI can misread complex legal language. The verbatim clauses exist so you can verify claims against the source — treat the summary as a fast starting point, not a legal opinion.
- **Performance on large documents.** Page extraction runs on the tab's rendering thread, so a very large document may briefly lag the page. (The AI call itself runs in the background and does not block the page.)
- **Cached revisits still re-read the page.** On a revisit, the extension re-extracts the page text before checking the cache — only the AI call is skipped, not the extraction.
- **Chromium only.** Works in Chrome, Edge, Brave, and Arc. It is not built for Firefox or Safari.
- **Client-side key storage.** Your key lives in the browser, which is fine for personal use — but a client-side key is extractable. Distributing this extension to other users would require routing calls through a backend proxy that holds the key instead.

---

## How it works

```
Visited page
   │
   ├─ Content script  → detects a legal doc and extracts clean text
   │                     (if the page only links to a policy, the linked
   │                      page is fetched and extracted instead)
   │
   └─ Service worker  → checks consent  → checks local cache
                        → on a cache miss, calls Gemini with a
                          schema-constrained prompt
                        → validates & normalizes the structured result
                          (sorts risk factors by severity)
   │
Side panel  → renders the summary, risk badge, and expandable clause breakdown
```

All AI work — the network request and JSON parsing — runs in the **service worker**, off the visited page's main thread. Consent is checked before any Gemini call, including the connection test.

## Tech stack

- **Manifest V3** (service worker, content script, side panel, options page)
- **Google Gemini API** (`generativelanguage` v1beta, `generateContent` with `responseSchema`); model configurable in Settings, defaulting to a current Gemini Flash model
- Vanilla JavaScript, no build step required

---

## Disclaimer

DIDN'T-READ provides automated summaries of legal documents for convenience and general understanding. It is **not** a substitute for professional legal advice. Always read the original document and consult a qualified professional for decisions with legal or financial consequences.
