/** Shared structured-output schema for all LLM providers */
const STRING_LIST = { type: 'array', maxItems: 4, items: { type: 'string' } };

const PRIORITY_ITEM = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['yes', 'no', 'unclear'] },
    answer: { type: 'string', description: 'One short plain-language line' },
  },
  required: ['status', 'answer'],
};

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    priorities: {
      type: 'object',
      properties: {
        sellsOrSharesData: PRIORITY_ITEM,
        dataForAdvertising: PRIORITY_ITEM,
        thirdPartySharing: PRIORITY_ITEM,
        hasRefundPolicy: PRIORITY_ITEM,
        hasCancellationPolicy: PRIORITY_ITEM,
        paymentsRefundable: PRIORITY_ITEM,
      },
      required: [
        'sellsOrSharesData',
        'dataForAdvertising',
        'thirdPartySharing',
        'hasRefundPolicy',
        'hasCancellationPolicy',
        'paymentsRefundable',
      ],
    },
    plainSummary: { type: 'string', description: '2-3 short sentences' },
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
              clause: { type: 'string', description: 'Verbatim snippet, max ~100 chars' },
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
              why: { type: 'string' },
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
  required: ['priorities', 'plainSummary', 'riskScore', 'keyPoints'],
};

/** @deprecated Use RESPONSE_SCHEMA */
const GEMINI_RESPONSE_SCHEMA = RESPONSE_SCHEMA;
