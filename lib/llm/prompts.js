const LANGUAGE_INSTRUCTIONS = {
  en: 'English',
  zh: 'Simplified Chinese',
  ms: 'Malay (Bahasa Melayu)',
  ta: 'Tamil',
};

const SYSTEM_PROMPT = `You summarize legal documents for everyday readers. Reply with compact JSON only.

Rules:
- Fill priorities FIRST with plain-language answers grounded in the document.
- Be brief: short bullets, short plainSummary, max 6 risk factors.
- riskScore.factors: only real verbatim clauses from the text (max ~100 chars each). Omit if not found.
- severity red_flag only for genuinely hostile clauses; routine terms are normal.
- Use [] for sections not in the source. Do not invent clauses.`;

/**
 * @param {import('../types.js').LlmSettings} [settings]
 */
function languageInstruction(settings) {
  const lang = settings?.language ?? 'en';
  const name = LANGUAGE_INSTRUCTIONS[lang] ?? LANGUAGE_INSTRUCTIONS.en;
  return `Write every string value in the JSON response in ${name}. Keep JSON keys in English.`;
}

/**
 * @param {{ text: string; docType?: string; title?: string }} doc
 * @param {import('../types.js').LlmSettings} [settings]
 */
function buildFullPrompt(doc, settings) {
  return {
    system: `${SYSTEM_PROMPT}\n\n${languageInstruction(settings)}`,
    user: `Summarize this ${doc.docType ?? 'legal'} document ("${doc.title ?? 'Untitled'}").

${doc.text}`,
  };
}

/**
 * @param {{ text: string; docType?: string; title?: string }} doc
 * @param {{ index: number; total: number; text: string }} chunk
 * @param {import('../types.js').LlmSettings} [settings]
 */
function buildChunkPrompt(doc, chunk, settings) {
  return {
    system: `${SYSTEM_PROMPT}\n\n${languageInstruction(settings)}`,
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
    priorities: partial.priorities,
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
 * @param {import('../types.js').LlmSettings} [settings]
 */
function buildMergePrompt(doc, partials, settings) {
  const slim = partials.map(slimPartial);
  return {
    system: `${SYSTEM_PROMPT}\n\n${languageInstruction(settings)}`,
    user: `Merge these partial analyses of "${doc.title ?? 'Untitled'}" into one JSON summary. Deduplicate. One riskScore for the whole doc. Merge priorities consistently. confidence=high|medium|low.

${JSON.stringify(slim)}`,
  };
}
