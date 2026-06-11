const matchingEngine = require('../services/MatchingEngine');
const { MATCH_STATUS } = require('../constants');

describe('MatchingEngine Scoring and Matching Tests', () => {
  const tolerances = {
    timestampToleranceSeconds: 300, // 5 minutes
    quantityTolerancePct: 0.01 // 1%
  };

  test('should match perfectly when all fields are identical or within tolerance (Score 100)', () => {
    const userTx = [
      {
        transactionId: 'USR-001',
        timestamp: new Date('2024-03-01T09:00:00Z'),
        type: 'BUY',
        asset: 'BTC',
        normalizedAsset: 'BTC',
        quantity: 0.5,
        priceUsd: 62000,
        fee: 0.0005,
        note: 'Monthly DCA'
      }
    ];

    const exchangeTx = [
      {
        transactionId: 'EXC-1001',
        timestamp: new Date('2024-03-01T09:00:10Z'), // 10s difference, within 300s
        type: 'BUY',
        asset: 'BTC',
        normalizedAsset: 'BTC',
        quantity: 0.50001, // 0.002% diff, within 1%
        priceUsd: 62000,
        fee: 0.0005,
        note: ''
      }
    ];

    const { results, summary } = matchingEngine.match(userTx, exchangeTx, tolerances);

    expect(summary.matched).toBe(1);
    expect(summary.conflicting).toBe(0);
    expect(results[0].status).toBe(MATCH_STATUS.MATCHED);
    expect(results[0].score).toBe(100);
  });

  test('should detect CONFLICTING when timestamp is outside tolerance (Score 80)', () => {
    const userTx = [
      {
        transactionId: 'USR-002',
        timestamp: new Date('2024-03-01T11:30:00Z'),
        type: 'BUY',
        asset: 'ETH',
        normalizedAsset: 'ETH',
        quantity: 2.0
      }
    ];

    const exchangeTx = [
      {
        transactionId: 'EXC-1002',
        timestamp: new Date('2024-03-01T11:45:00Z'), // 15 mins diff, outside 5 mins tolerance
        type: 'BUY',
        asset: 'ETH',
        normalizedAsset: 'ETH',
        quantity: 2.0
      }
    ];

    const { results, summary } = matchingEngine.match(userTx, exchangeTx, tolerances);

    expect(summary.matched).toBe(0);
    expect(summary.conflicting).toBe(1);
    expect(results[0].status).toBe(MATCH_STATUS.CONFLICTING);
    expect(results[0].score).toBe(80);
    expect(results[0].reason).toContain('Timestamp discrepancy');
  });

  test('should handle asset aliases and inverse type mappings correctly', () => {
    const userTx = [
      {
        transactionId: 'USR-004',
        timestamp: new Date('2024-03-02T14:45:00Z'),
        type: 'TRANSFER_OUT',
        asset: 'ETH',
        normalizedAsset: 'ETH',
        quantity: 1.0
      }
    ];

    const exchangeTx = [
      {
        transactionId: 'EXC-1004',
        timestamp: new Date('2024-03-02T14:45:00Z'),
        type: 'TRANSFER_IN', // Inverse mapping
        asset: 'ETH',
        normalizedAsset: 'ETH',
        quantity: 1.0
      }
    ];

    const { results, summary } = matchingEngine.match(userTx, exchangeTx, tolerances);

    expect(summary.matched).toBe(1);
    expect(results[0].status).toBe(MATCH_STATUS.MATCHED);
  });

  test('should identify duplicate user transactions and mark them unmatched', () => {
    const userTx = [
      {
        transactionId: 'USR-001',
        timestamp: new Date('2024-03-01T09:00:00Z'),
        type: 'BUY',
        asset: 'BTC',
        normalizedAsset: 'BTC',
        quantity: 0.5
      },
      {
        transactionId: 'USR-001', // Duplicate ID
        timestamp: new Date('2024-03-01T09:00:00Z'),
        type: 'BUY',
        asset: 'BTC',
        normalizedAsset: 'BTC',
        quantity: 0.5
      }
    ];

    const exchangeTx = [
      {
        transactionId: 'EXC-1001',
        timestamp: new Date('2024-03-01T09:00:00Z'),
        type: 'BUY',
        asset: 'BTC',
        normalizedAsset: 'BTC',
        quantity: 0.5
      }
    ];

    const { results, summary } = matchingEngine.match(userTx, exchangeTx, tolerances);

    // The first one should match, the second duplicate one should be unmatched
    expect(summary.matched).toBe(1);
    expect(summary.unmatchedUser).toBe(1);
    
    const duplicateResult = results.find(r => r.reason.includes('Duplicate transaction ID'));
    expect(duplicateResult).toBeDefined();
    expect(duplicateResult.status).toBe(MATCH_STATUS.UNMATCHED);
  });
});
