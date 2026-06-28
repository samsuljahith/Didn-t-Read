/** Gemini OpenAPI-style responseSchema for legal analysis JSON */
const GEMINI_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    plainSummary: {
      type: 'string',
      description: '2-4 sentence plain-English overview of the document',
    },
    riskScore: {
      type: 'object',
      properties: {
        value: {
          type: 'integer',
          description:
            'Overall risk 0 (consumer-friendly) to 100 (very concerning); must align with factors',
        },
        label: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'low (0-33), medium (34-66), or high (67-100); justified by factors',
        },
        factors: {
          type: 'array',
          description:
            'Clause-grounded risk drivers cited verbatim from the document; omit if not found in text',
          items: {
            type: 'object',
            properties: {
              clause: {
                type: 'string',
                description: 'Short verbatim snippet copied exactly from the document',
              },
              category: {
                type: 'string',
                enum: [
                  'data_collection',
                  'third_party_sharing',
                  'auto_renewal',
                  'cancellation',
                  'liability',
                  'content_rights',
                  'other',
                ],
              },
              severity: {
                type: 'string',
                enum: ['normal', 'caution', 'red_flag'],
                description:
                  'normal for routine terms; caution for noteworthy; red_flag only for genuinely user-hostile clauses',
              },
              why: {
                type: 'string',
                description: 'One plain-English line explaining why this clause matters to the user',
              },
            },
            required: ['clause', 'category', 'severity', 'why'],
          },
        },
      },
      required: ['value', 'label', 'factors'],
    },
    keyPoints: {
      type: 'array',
      items: { type: 'string' },
    },
    riskyClauses: {
      type: 'array',
      items: { type: 'string' },
    },
    dataCollection: {
      type: 'array',
      items: { type: 'string' },
    },
    thirdPartySharing: {
      type: 'array',
      items: { type: 'string' },
    },
    subscriptionTerms: {
      type: 'array',
      items: { type: 'string' },
    },
    cancellationRefund: {
      type: 'array',
      items: { type: 'string' },
    },
    userObligations: {
      type: 'array',
      items: { type: 'string' },
    },
    legalClauses: {
      type: 'array',
      items: { type: 'string' },
    },
    confidence: {
      type: 'string',
      description: 'high, medium, low, or partial (chunk-only analyses)',
    },
  },
  required: [
    'plainSummary',
    'riskScore',
    'keyPoints',
    'riskyClauses',
    'dataCollection',
    'thirdPartySharing',
    'subscriptionTerms',
    'cancellationRefund',
    'userObligations',
    'legalClauses',
  ],
};
