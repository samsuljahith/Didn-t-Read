<p align="center">
  <img src="icons/icon128.png" alt="Didn't Read logo" width="128" height="128" />
</p>

# Didn't Read

**Understand any Terms of Service, Privacy Policy, or Cookie Policy in seconds — not minutes.**

Didn't Read is a Chromium browser extension that detects legal documents on the page you're viewing, analyzes them with your chosen AI provider (or Chrome's on-device model), and presents a concise, structured summary in a side panel — including your top privacy concerns first and an explainable risk score where every point is tied to the exact clause that triggered it.

The logo is a minimalist document frame with a teal checkmark — purple (`#2E1A68`) and teal (`#1ABC9C`) signal clarity and “verified at a glance.”

---

## How it's different

Most policy-summary tools take one of two approaches, and both have a real weakness:

- **Human-reviewed databases** (like ToS;DR) are accurate when covered, but summaries can be months or years out of date, and smaller or brand-new sites often show “No Class Yet.”
- **Single-grade AI tools** (like Termzy AI) give you one overall score with little explanation of *why*, and can misread complex legal language.

Didn't Read takes a different path:

- **Live, not stale** — analyzes the **actual policy text on the page in front of you**, so it's never months behind a volunteer database.
- **Any site, not just popular ones** — works on niche, local, and just-launched sites; no manual review coverage gap.
- **Explainable, not a black box** — six priority answers first, then a risk score with **verbatim clauses** you can click to verify. We do **not** claim to eliminate AI errors — we make them easier to catch.

---

## vs ToS;DR and Termzy AI

| Weakness | ToS;DR | Termzy AI | Didn't Read |
|----------|--------|-----------|-------------|
| Outdated summaries | Volunteer DB lags policy updates | Live analysis | **Live analysis** + Re-analyze |
| Niche / new sites | “No Class Yet” | Works if page is readable | **Works on any detectable policy page** |
| Opaque or harsh grading | Subjective A–E grade | Single AI grade | **Explainable score + clause quotes** |
| AI hallucination | N/A (human DB) | Can misread jargon | **Mitigated** — grounding check + “View clause” |
| Browser lag on huge policies | N/A | Can stutter | **Partially mitigated** — idle-yield extraction + SW-side LLM |
| Chromium-only | Yes | Yes | Yes (not solved) |
| Privacy / reads your pages | Lower (pre-reviewed DB) | Cloud AI irony | **Consent gate** + optional **on-device Chrome AI** |

**What we don't claim:** lawyer-grade accuracy, zero AI mistakes, zero browser impact on enormous policies, or Firefox/Safari support.

---

## Features

- **Automatic detection** of Terms & Conditions, Privacy Policies, and Cookie Policies — whether the page *is* a policy or just links to one. Non-legal pages (blogs, product listings, etc.) are blocked before any text is sent for analysis.
- **Clean extraction** of the legal text, stripping navigation, footers, and ads. Large pages use idle-yielding extraction to reduce tab jank.
- **Your choice of AI provider** — **Chrome on-device AI** (no API key, local processing), Google Gemini, OpenAI, Anthropic Claude, or xAI Grok.
- **Grounding guard** — priority answers and risk clauses are checked against the extracted page text; unverified claims are downgraded to “unclear.”
- **Top-priority answers first** — six plain-language cards (yes / no / unclear) for data selling, advertising, third-party sharing, refunds, cancellation, and payment terms.
- **Explainable, clause-grounded risk score**: 0–100 with a visual meter, severity breakdown, and expandable factors — each with verbatim clause text.
- **Multi-language UI and output** — English, Chinese, Malay, and Tamil (Singapore-focused).
- **Friendly first-run setup** — 3-step side-panel flow for cloud providers. Detection works before setup; choose **Chrome on-device AI** in Settings to skip the API key entirely.
- **Privacy consent gate**: nothing is sent until you accept a clear disclosure. Consent is versioned; withdraw any time from Settings.
- **Local caching**: revisiting an already-analyzed page returns instantly without a new AI call. **Re-analyze** forces a fresh pass.

---

## Install (unpacked)

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome (or any Chromium browser — Edge, Brave, Arc).
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the extension folder.
5. The Didn't Read icon appears in your toolbar.

**Chrome on-device AI** requires Chrome **131+** with Gemini Nano available (`chrome://on-device-internals` or `chrome://flags`).

## Setup

**Option A — No API key (most private cloud-free path)**

1. Open **Settings** → Provider → **Chrome on-device AI**.
2. Visit a policy page → open the side panel → accept consent → **Summarize**.

**Option B — Cloud provider (Gemini, OpenAI, Claude, Grok)**

1. Visit a policy page — you'll see **policy detected** even before setup.
2. Click **Summarize** → follow the 3-step setup: get a key, paste it, **Connect**.
3. Accept the privacy disclosure the first time you analyze.

## Usage

1. Visit any page containing a Terms, Privacy, or Cookie policy (or a hub page that links to one).
2. Open the side panel (click the toolbar icon).
3. Click **Summarize**.
4. Read your top six concerns, then the risk meter and breakdown; click **View clause** on any factor to see the exact source text.
5. Use **Re-analyze** to bypass the cache and run a fresh analysis.

---

## Privacy

Didn't Read is built for a privacy-conscious audience, so it's direct about what it does:

- **Chrome on-device mode:** legal text is processed locally via Chrome's built-in language model. No cloud API key; no data sent to Gemini/OpenAI/etc.
- **Cloud provider mode:** detected legal-document text is sent to your chosen provider when you summarize. Nothing is sent until you accept the disclosure.
- Analysis results are stored only in a **local cache on your device**. No telemetry or analytics.
- Cloud API keys are stored locally and sent only to the active provider.

This is **not** legal advice, and cloud AI mode is **not** fully local processing.

---

## Known limitations

Named honestly, because a tool you can trust is one that tells you its edges:

- **Not legal advice.** AI can misread complex legal language. Grounding checks and verbatim clauses help you verify claims — they do not guarantee correctness.
- **Performance on large documents.** Extraction is improved with idle-yielding but very large pages may still briefly lag. The AI call runs in the background service worker.
- **Cached revisits still re-read the page.** Only the AI call is skipped on cache hit, not extraction.
- **Chromium only.** Not built for Firefox or Safari.
- **On-device AI quality** depends on Chrome's Gemini Nano availability and may be less capable than cloud models on long documents.
- **Client-side key storage** (cloud mode). Keys are recoverable by anyone with device access.

---

## How it works

```
Visited page
   │
   ├─ Content script  → scores legal doc; extracts clean text (idle-yield on large pages)
   │                     non-legal pages stop here — no text sent upstream
   │
   └─ Service worker  → consent → cache → LLM (on-device or cloud)
                        → validate JSON → ground claims against source text
   │
Side panel  → priorities → risk meter → breakdown → summary sections
```

---

## Tech stack

- **Manifest V3** (service worker, content script, side panel, offscreen document for on-device AI)
- **Provider-agnostic LLM layer** with structured JSON output
- **Grounding guard** ([`lib/grounding.js`](lib/grounding.js)) post-validates AI claims against source text
- Vanilla JavaScript, no build step required

---

## Disclaimer

Didn't Read provides automated summaries of legal documents for convenience and general understanding. It is **not** a substitute for professional legal advice. Always read the original document and consult a qualified professional for decisions with legal or financial consequences.
