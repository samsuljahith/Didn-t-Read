const SYSTEM_PROMPT = `You summarize legal documents for everyday readers. Reply with compact JSON only.

Rules:
- Be brief: short bullets, short plainSummary, max 6 risk factors.
- riskScore.factors: only real verbatim clauses from the text (max ~100 chars each). Omit if not found.
- severity red_flag only for genuinely hostile clauses; routine terms are normal.
- Use [] for sections not in the source. Do not invent clauses.`;

/**
 * @param {{ text: string; docType?: string; title?: string }} doc
 */
function buildFullPrompt(doc) {
  return {
    system: SYSTEM_PROMPT,
    user: `Summarize this ${doc.docType ?? 'legal'} document ("${doc.title ?? 'Untitled'}").

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
    user: `Chunk ${chunk.index + 1}/${chunk.total} of "${doc.title ?? 'Untitled'}". confidence=partial. Only content in this chunk.

${chunk.text}`,
  };
}

/**
 * @param {import('../types.js').StructuredSummary} partial
 */
function slimPartial(partial) {
  const rs = partial.riskScore ?? { value: 50, label: 'medium', factors: [] };
  return {
    plainSummary: partial.plainSummary,
    riskScore: {
      value: rs.value ?? rs.score ?? 50,
      label: rs.label ?? 'medium',
      factors: (rs.factors ?? []).slice(0, 6),
    },
    keyPoints: (partial.keyPoints ?? []).slice(0, 6),
    riskyClauses: (partial.riskyClauses ?? []).slice(0, 3),
    dataCollection: (partial.dataCollection ?? []).slice(0, 3),
    thirdPartySharing: (partial.thirdPartySharing ?? []).slice(0, 3),
    subscriptionTerms: (partial.subscriptionTerms ?? []).slice(0, 3),
    cancellationRefund: (partial.cancellationRefund ?? []).slice(0, 3),
    userObligations: (partial.userObligations ?? []).slice(0, 3),
    legalClauses: (partial.legalClauses ?? []).slice(0, 3),
    confidence: partial.confidence,
  };
}

/**
 * @param {{ docType?: string; title?: string }} doc
 * @param {import('../types.js').StructuredSummary[]} partials
 */
function buildMergePrompt(doc, partials) {
  const slim = partials.map(slimPartial);
  return {
    system: SYSTEM_PROMPT,
    user: `Merge these partial analyses of "${doc.title ?? 'Untitled'}" into one JSON summary. Deduplicate. One riskScore for the whole doc. confidence=high|medium|low.

${JSON.stringify(slim)}`,
  };
}
