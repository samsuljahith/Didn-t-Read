/** Compact schema — small JSON replies parse reliably and run faster */
const STRING_LIST = { type: 'array', maxItems: 4, items: { type: 'string' } };

const GEMINI_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    plainSummary: {
      type: 'string',
      description: '2-3 short sentences, plain English',
    },
    riskScore: {
      type: 'object',
      properties: {
        value: { type: 'integer', description: '0-100 overall risk' },
        label: { type: 'string', enum: ['low', 'medium', 'high'] },
        factors: {
          type: 'array',
          maxItems: 6,
          items: {
            type: 'object',
            properties: {
              clause: {
                type: 'string',
                description: 'Verbatim snippet from doc, max ~100 characters',
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
              severity: { type: 'string', enum: ['normal', 'caution', 'red_flag'] },
              why: { type: 'string', description: 'One short line for the user' },
            },
            required: ['clause', 'category', 'severity', 'why'],
          },
        },
      },
      required: ['value', 'label', 'factors'],
    },
    keyPoints: { type: 'array', maxItems: 6, items: { type: 'string' } },
    riskyClauses: STRING_LIST,
    dataCollection: STRING_LIST,
    thirdPartySharing: STRING_LIST,
    subscriptionTerms: STRING_LIST,
    cancellationRefund: STRING_LIST,
    userObligations: STRING_LIST,
    legalClauses: STRING_LIST,
    confidence: { type: 'string', enum: ['high', 'medium', 'low', 'partial'] },
  },
  required: ['plainSummary', 'riskScore', 'keyPoints'],
};
