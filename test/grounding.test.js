import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function loadGrounding() {
  const context = { globalThis: {} };
  vm.createContext(context);
  vm.runInContext(readFileSync(join(ROOT, 'lib/llm/validate-summary.js'), 'utf8'), context);
  vm.runInContext(readFileSync(join(ROOT, 'lib/grounding.js'), 'utf8'), context);
  return context.groundSummary;
}

describe('groundSummary()', () => {
  const groundSummary = loadGrounding();

  const source =
    'We may sell personal data to advertising partners. Third parties receive analytics data. ' +
    'Refunds are available within 14 days of purchase.';

  const baseSummary = {
    priorities: {
      sellsOrSharesData: { status: 'yes', answer: 'We may sell personal data to advertising partners.' },
      dataForAdvertising: { status: 'yes', answer: 'Data shared with advertising partners.' },
      thirdPartySharing: { status: 'yes', answer: 'Third parties receive analytics data.' },
      hasRefundPolicy: { status: 'yes', answer: 'Refunds are available within 14 days.' },
      hasCancellationPolicy: { status: 'unclear', answer: '' },
      paymentsRefundable: { status: 'unclear', answer: '' },
    },
    plainSummary: 'Summary',
    riskScore: {
      value: 60,
      label: 'medium',
      factors: [
        {
          clause: 'We may sell personal data to advertising partners.',
          category: 'data_collection',
          severity: 'caution',
          why: 'Selling data',
        },
        {
          clause: 'Completely invented clause about Mars colonies.',
          category: 'other',
          severity: 'red_flag',
          why: 'Fake',
        },
      ],
    },
    keyPoints: [],
    riskyClauses: [],
    dataCollection: [],
    thirdPartySharing: [],
    subscriptionTerms: [],
    cancellationRefund: [],
    userObligations: [],
    legalClauses: [],
  };

  it('keeps grounded priority answers and risk factors', () => {
    const result = groundSummary(baseSummary, source);
    assert.equal(result.priorities.sellsOrSharesData.status, 'yes');
    assert.equal(result.riskScore.factors.length, 1);
    assert.ok(result.riskScore.factors[0].clause.includes('sell personal data'));
  });

  it('downgrades ungrounded yes/no priority answers to unclear', () => {
    const hallucinated = {
      ...baseSummary,
      priorities: {
        ...baseSummary.priorities,
        sellsOrSharesData: {
          status: 'yes',
          answer: 'The company always sells data to alien civilizations.',
        },
      },
    };
    const result = groundSummary(hallucinated, source);
    assert.equal(result.priorities.sellsOrSharesData.status, 'unclear');
    assert.match(result.priorities.sellsOrSharesData.answer, /Could not verify/i);
  });
});
