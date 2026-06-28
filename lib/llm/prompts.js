const SUMMARY_SCHEMA = `{
  "plainSummary": "2-4 sentence plain-English overview",
  "riskScore": { "score": 0-100, "label": "Low|Moderate|High" },
  "keyPoints": ["most important takeaways"],
  "riskyClauses": ["unusual, one-sided, or concerning clauses"],
  "dataCollection": ["what personal data is collected"],
  "thirdPartySharing": ["who data is shared with and why"],
  "subscriptionTerms": ["billing, renewal, pricing terms if applicable"],
  "cancellationRefund": ["cancel, refund, and termination terms"],
  "userObligations": ["what the user must do or avoid"],
  "legalClauses": ["governing law, arbitration, liability, warranties"],
  "confidence": "high|medium|low|partial"
}`;

const SYSTEM_PROMPT =
  'You analyze legal documents for everyday users. Respond with valid JSON only, no markdown fences. Use empty arrays for sections not present in the text.';

/**
 * @param {import('../types.js').ExtractedDoc} doc
 */
function buildFullPrompt(doc) {
  return {
    system: SYSTEM_PROMPT,
    user: `Analyze this ${doc.docType} document titled "${doc.title}".

Return JSON matching this schema:
${SUMMARY_SCHEMA}

Set riskScore.score from 0 (very consumer-friendly) to 100 (very concerning) based on the full document.

Document text:
${doc.text}`,
  };
}

/**
 * @param {import('../types.js').ExtractedDoc} doc
 * @param {{ index: number; total: number; text: string }} chunk
 */
function buildChunkPrompt(doc, chunk) {
  return {
    system: SYSTEM_PROMPT,
    user: `This is chunk ${chunk.index + 1} of ${chunk.total} from a ${doc.docType} document titled "${doc.title}".
Analyze ONLY what appears in this chunk. Set confidence to "partial". Use empty arrays for topics not in this chunk.

Return JSON matching this schema:
${SUMMARY_SCHEMA}

Chunk text:
${chunk.text}`,
  };
}

/**
 * @param {import('../types.js').ExtractedDoc} doc
 * @param {import('../types.js').StructuredSummary[]} partials
 */
function buildMergePrompt(doc, partials) {
  return {
    system: SYSTEM_PROMPT,
    user: `Merge these partial analyses of a ${doc.docType} document titled "${doc.title}" into one final analysis.
Deduplicate bullets, reconcile conflicts, produce one cohesive plainSummary, and set a single riskScore for the whole document. Set confidence to high, medium, or low (not partial).

Return JSON matching this schema:
${SUMMARY_SCHEMA}

Partial analyses:
${JSON.stringify(partials, null, 2)}`,
  };
}
