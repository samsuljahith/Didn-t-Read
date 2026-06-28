const RISK_SCORE_INSTRUCTIONS = `Risk score rules (riskScore):
- riskScore.factors is the primary evidence. Each factor MUST cite a short clause copied VERBATIM from the document text — never paraphrase or invent wording.
- If you cannot find a supporting clause in the text, omit that factor entirely. Never fabricate a clause.
- severity "normal": routine, standard business terms (e.g. basic contact info collection, standard liability caps).
- severity "caution": noteworthy terms users should understand but are common in the industry.
- severity "red_flag": genuinely user-hostile or unusually one-sided clauses only — use sparingly.
- riskScore.value (0-100) and riskScore.label (low/medium/high) MUST be justified by the factors: weigh red_flag > caution > normal.
- label bands: low = 0-33, medium = 34-66, high = 67-100.`;

const SYSTEM_PROMPT = `You analyze legal documents for everyday users. Use empty arrays for sections not present in the source text.

${RISK_SCORE_INSTRUCTIONS}`;

/**
 * @param {{ text: string; docType?: string; title?: string }} doc
 */
function buildFullPrompt(doc) {
  return {
    system: SYSTEM_PROMPT,
    user: `Analyze this ${doc.docType ?? 'legal'} document titled "${doc.title ?? 'Untitled'}".

Populate riskScore.factors with clause-grounded evidence from the document below. Cite only clauses actually present in the text.

Document text:
${doc.text}`,
  };
}

/**
 * @param {{ text: string; docType?: string; title?: string }} doc
 * @param {{ index: number; total: number; text: string }} chunk
 */
function buildChunkPrompt(doc, chunk) {
  return {
    system: SYSTEM_PROMPT,
    user: `This is chunk ${chunk.index + 1} of ${chunk.total} from a ${doc.docType ?? 'legal'} document titled "${doc.title ?? 'Untitled'}".
Analyze ONLY what appears in this chunk. Set confidence to "partial". Use empty arrays for topics not in this chunk.
For riskScore.factors, include only clauses found in THIS chunk — never invent text.

Chunk text:
${chunk.text}`,
  };
}

/**
 * @param {{ docType?: string; title?: string }} doc
 * @param {import('../types.js').StructuredSummary[]} partials
 */
function buildMergePrompt(doc, partials) {
  return {
    system: SYSTEM_PROMPT,
    user: `Merge these partial analyses of a ${doc.docType ?? 'legal'} document titled "${doc.title ?? 'Untitled'}" into one final analysis.
Deduplicate bullets and risk factors (merge factors with the same verbatim clause).
Reconcile conflicts, produce one cohesive plainSummary, and set a single riskScore for the whole document.
riskScore.value and riskScore.label must reflect the merged factors. Set confidence to high, medium, or low (not partial).

Partial analyses:
${JSON.stringify(partials, null, 2)}`,
  };
}
