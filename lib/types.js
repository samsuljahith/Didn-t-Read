/** JSDoc-only types — not imported by the service worker (no runtime code). */

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
 * @property {string} [blockReason]
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
 * @typedef {'low' | 'medium' | 'high'} RiskLabel
 *
 * @typedef {'data_collection' | 'third_party_sharing' | 'auto_renewal' | 'cancellation' | 'liability' | 'content_rights' | 'other'} RiskFactorCategory
 *
 * @typedef {'normal' | 'caution' | 'red_flag'} RiskFactorSeverity
 *
 * @typedef {Object} RiskFactor
 * @property {string} clause
 * @property {RiskFactorCategory} category
 * @property {RiskFactorSeverity} severity
 * @property {string} why
 *
 * @typedef {Object} RiskScore
 * @property {number} value
 * @property {RiskLabel} label
 * @property {RiskFactor[]} factors
 *
 * @typedef {'yes' | 'no' | 'unclear'} PriorityStatus
 *
 * @typedef {Object} PriorityAnswer
 * @property {PriorityStatus} status
 * @property {string} answer
 *
 * @typedef {Object} PriorityConcerns
 * @property {PriorityAnswer} sellsOrSharesData
 * @property {PriorityAnswer} dataForAdvertising
 * @property {PriorityAnswer} thirdPartySharing
 * @property {PriorityAnswer} hasRefundPolicy
 * @property {PriorityAnswer} hasCancellationPolicy
 * @property {PriorityAnswer} paymentsRefundable
 *
 * @typedef {Object} LegalAnalysis
 * @property {PriorityConcerns} priorities
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
 * @typedef {'gemini' | 'openai' | 'anthropic' | 'grok' | 'chrome'} ProviderId
 *
 * @typedef {'en' | 'zh' | 'ms' | 'ta'} AppLanguage
 *
 * @typedef {Object} LlmSettings
 * @property {ProviderId} providerId
 * @property {string} providerUrl
 * @property {string} model
 * @property {AppLanguage} [language]
 * @property {number} [maxChunkTokens]
 * @property {number} [temperature]
 *
 * @typedef {Object} JobProgress
 * @property {'detecting' | 'extracting' | 'fetching' | 'summarizing' | 'chunking' | 'reducing'} phase
 * @property {number} current
 * @property {number} total
 *
 * @typedef {Object} TabSummaryCache
 * @property {ExtractedDoc} doc
 * @property {StructuredSummary} summary
 * @property {boolean} [fromCache]
 */
