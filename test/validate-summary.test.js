import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function loadValidateSummary() {
  const context = { globalThis: {} };
  vm.createContext(context);
  vm.runInContext(readFileSync(join(ROOT, 'lib/llm/validate-summary.js'), 'utf8'), context);
  return { validateSummary: context.validateSummary, parseSummaryJson: context.parseSummaryJson };
}

describe('validateSummary()', () => {
  const { validateSummary } = loadValidateSummary();

  it('normalizes priorities with default unclear when missing', () => {
    const result = validateSummary({
      plainSummary: 'Test summary',
      riskScore: { value: 30, label: 'low', factors: [] },
      keyPoints: ['One point'],
    });

    assert.equal(result.priorities.sellsOrSharesData.status, 'unclear');
    assert.equal(result.priorities.dataForAdvertising.status, 'unclear');
    assert.equal(result.priorities.paymentsRefundable.answer, '');
  });

  it('preserves valid priority statuses and answers', () => {
    const result = validateSummary({
      priorities: {
        sellsOrSharesData: { status: 'yes', answer: 'Data may be sold to partners.' },
        dataForAdvertising: { status: 'no', answer: 'No advertising use stated.' },
        thirdPartySharing: { status: 'unclear', answer: 'Sharing not clearly defined.' },
        hasRefundPolicy: { status: 'yes', answer: '14-day refund window.' },
        hasCancellationPolicy: { status: 'no', answer: 'No cancellation terms found.' },
        paymentsRefundable: { status: 'invalid', answer: 'Non-refundable.' },
      },
      plainSummary: 'Summary',
      riskScore: { value: 50, label: 'medium', factors: [] },
      keyPoints: [],
    });

    assert.equal(result.priorities.sellsOrSharesData.status, 'yes');
    assert.equal(result.priorities.sellsOrSharesData.answer, 'Data may be sold to partners.');
    assert.equal(result.priorities.dataForAdvertising.status, 'no');
    assert.equal(result.priorities.paymentsRefundable.status, 'unclear');
    assert.equal(result.priorities.paymentsRefundable.answer, 'Non-refundable.');
  });
});

describe('parseSummaryJson()', () => {
  const { parseSummaryJson } = loadValidateSummary();

  it('parses JSON wrapped in markdown fences', () => {
    const raw = '```json\n{"priorities":{"sellsOrSharesData":{"status":"no","answer":"No sale."},"dataForAdvertising":{"status":"no","answer":""},"thirdPartySharing":{"status":"no","answer":""},"hasRefundPolicy":{"status":"unclear","answer":""},"hasCancellationPolicy":{"status":"unclear","answer":""},"paymentsRefundable":{"status":"unclear","answer":""}},"plainSummary":"Short.","riskScore":{"value":20,"label":"low","factors":[]},"keyPoints":[]}\n```';
    const result = parseSummaryJson(raw);
    assert.equal(result.priorities.sellsOrSharesData.status, 'no');
    assert.equal(result.plainSummary, 'Short.');
  });
});
