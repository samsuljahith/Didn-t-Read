/**
 * @typedef {'privacy' | 'terms' | 'cookies' | 'unknown'} DocType
 *
 * @typedef {Object} DetectionResult
 * @property {DocType} docType
 * @property {number} confidence
 * @property {string} label
 * @property {boolean} needsConfirmation
 *
 * @typedef {'document' | 'hub' | 'unknown'} PageMode
 *
 * @typedef {Object} ExtractedDoc
 * @property {DocType} docType
 * @property {number} confidence
 * @property {boolean} needsConfirmation
 * @property {PageMode} [mode]
 * @property {boolean} [isLegal]
 * @property {boolean} [needsFetch]
 * @property {string} [policyUrl]
 * @property {string} sourceUrl
 * @property {string} [originalUrl]
 * @property {boolean} [fetchedFromHub]
 * @property {string} [linkLabel]
 * @property {string} title
 * @property {string} text
 * @property {number} wordCount
 * @property {string} extractedAt
 *
 * @typedef {Object} RiskScore
 * @property {number} score
 * @property {string} label
 *
 * @typedef {Object} LegalAnalysis
 * @property {string} plainSummary
 * @property {RiskScore} riskScore
 * @property {string[]} keyPoints
 * @property {string[]} riskyClauses
 * @property {string[]} dataCollection
 * @property {string[]} thirdPartySharing
 * @property {string[]} subscriptionTerms
 * @property {string[]} cancellationRefund
 * @property {string[]} userObligations
 * @property {string[]} legalClauses
 * @property {string} [docType]
 * @property {'high' | 'medium' | 'low' | 'partial'} [confidence]
 *
 * @typedef {LegalAnalysis} StructuredSummary
 *
 * @typedef {Object} LlmSettings
 * @property {string} providerUrl
 * @property {string} model
 * @property {number} [maxChunkTokens]
 * @property {number} [temperature]
 *
 * @typedef {Object} JobProgress
 * @property {'detecting' | 'fetching' | 'summarizing' | 'chunking' | 'reducing'} phase
 * @property {number} current
 * @property {number} total
 *
 * @typedef {Object} TabSummaryCache
 * @property {ExtractedDoc} doc
 * @property {StructuredSummary} summary
 */
