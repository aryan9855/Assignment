const { MATCH_STATUS, TYPE_MAPPINGS, SCORING } = require('../constants');

class MatchingEngine {
  /**
   * Run matching logic between user and exchange transactions
   * @param {Array} userTxList 
   * @param {Array} exchangeTxList 
   * @param {Object} tolerances { timestampToleranceSeconds, quantityTolerancePct }
   * @returns {Object} { results, summary }
   */
  match(userTxList, exchangeTxList, tolerances) {
    const { timestampToleranceSeconds, quantityTolerancePct } = tolerances;
    const results = [];

    // Track duplicate transaction IDs on both sides
    const seenUserIds = new Set();
    const seenExchangeIds = new Set();

    const uniqueUserTxs = [];
    const duplicateUserTxs = [];
    
    // Categorize User Transactions
    userTxList.forEach((tx, idx) => {
      const txId = tx.transactionId;
      if (seenUserIds.has(txId)) {
        tx.isDuplicate = true;
        duplicateUserTxs.push({ tx, rawRowIndex: idx + 2 });
      } else {
        seenUserIds.add(txId);
        uniqueUserTxs.push({ tx, rawRowIndex: idx + 2 });
      }
    });

    // Categorize Exchange Transactions
    const exchangeMap = [];
    const duplicateExchangeTxs = [];

    exchangeTxList.forEach((tx, idx) => {
      const txId = tx.transactionId;
      if (seenExchangeIds.has(txId)) {
        tx.isDuplicate = true;
        duplicateExchangeTxs.push({ tx, rawRowIndex: idx + 2 });
      } else {
        seenExchangeIds.add(txId);
        exchangeMap.push({
          tx,
          rawRowIndex: idx + 2,
          consumed: false
        });
      }
    });

    // Match unique transactions
    for (const userWrapper of uniqueUserTxs) {
      const uTx = userWrapper.tx;
      const uIdx = userWrapper.rawRowIndex;

      // Find mapped exchange type
      const targetExchangeType = TYPE_MAPPINGS[uTx.type];

      // Find candidates from exchange transactions
      let bestCandidate = null;
      let highestScore = -1;
      let bestDiscrepancies = null;

      for (const excWrapper of exchangeMap) {
        if (excWrapper.consumed) continue;

        const eTx = excWrapper.tx;

        // Calculate score
        let score = 0;
        let assetMatch = false;
        let typeMatch = false;
        let quantityMatch = false;
        let timestampMatch = false;

        // 1. Asset Match
        if (uTx.normalizedAsset === eTx.normalizedAsset) {
          score += SCORING.ASSET_MATCH;
          assetMatch = true;
        }

        // 2. Type Match (Check mapping)
        if (targetExchangeType && eTx.type === targetExchangeType) {
          score += SCORING.TYPE_MATCH;
          typeMatch = true;
        }

        // Only calculate further if asset and type are matching candidate
        if (assetMatch && typeMatch) {
          // 3. Quantity within Tolerance
          const quantityDiff = Math.abs(uTx.quantity - eTx.quantity);
          const quantityDiffPct = quantityDiff / uTx.quantity;
          if (quantityDiffPct <= quantityTolerancePct) {
            score += SCORING.QUANTITY_MATCH;
            quantityMatch = true;
          }

          // 4. Timestamp within Tolerance
          const timeDiffSeconds = Math.abs(uTx.timestamp.getTime() - eTx.timestamp.getTime()) / 1000;
          if (timeDiffSeconds <= timestampToleranceSeconds) {
            score += SCORING.TIMESTAMP_MATCH;
            timestampMatch = true;
          }

          // We keep the candidate with the highest score
          if (score >= SCORING.THRESHOLD_CONFLICTING && score > highestScore) {
            highestScore = score;
            bestCandidate = excWrapper;
            bestDiscrepancies = {
              quantityDiff,
              quantityDiffPct,
              timeDiffSeconds
            };
          }
        }
      }

      if (bestCandidate) {
        // Mark exchange transaction as consumed
        bestCandidate.consumed = true;

        const isExactMatch = highestScore === SCORING.THRESHOLD_MATCHED;
        const status = isExactMatch ? MATCH_STATUS.MATCHED : MATCH_STATUS.CONFLICTING;

        // Construct reason
        let reason = '';
        if (isExactMatch) {
          reason = 'Exact match across asset, type, quantity, and timestamp.';
        } else {
          const reasons = [];
          if (bestDiscrepancies.quantityDiffPct > quantityTolerancePct) {
            reasons.push(`Quantity discrepancy: ${bestDiscrepancies.quantityDiffPct.toFixed(4)}% vs tolerance ${quantityTolerancePct}%`);
          }
          if (bestDiscrepancies.timeDiffSeconds > timestampToleranceSeconds) {
            reasons.push(`Timestamp discrepancy: ${bestDiscrepancies.timeDiffSeconds}s vs tolerance ${timestampToleranceSeconds}s`);
          }
          reason = `Conflicting match details: ${reasons.join('; ')}`;
        }

        results.push({
          status,
          reason,
          score: highestScore,
          userTransaction: this.formatTxPayload(uTx, uIdx),
          exchangeTransaction: this.formatTxPayload(bestCandidate.tx, bestCandidate.rawRowIndex),
          discrepancies: bestDiscrepancies
        });
      } else {
        // No match found
        results.push({
          status: MATCH_STATUS.UNMATCHED,
          reason: 'No matching exchange transaction found within parameters.',
          score: 0,
          userTransaction: this.formatTxPayload(uTx, uIdx),
          exchangeTransaction: null
        });
      }
    }

    // Process unconsumed Exchange Transactions
    exchangeMap.forEach((excWrapper) => {
      if (!excWrapper.consumed) {
        results.push({
          status: MATCH_STATUS.UNMATCHED,
          reason: 'No matching user transaction found within parameters.',
          score: 0,
          userTransaction: null,
          exchangeTransaction: this.formatTxPayload(excWrapper.tx, excWrapper.rawRowIndex)
        });
      }
    });

    // Record Duplicate User Transactions as Unmatched
    duplicateUserTxs.forEach((dup) => {
      results.push({
        status: MATCH_STATUS.UNMATCHED,
        reason: `Duplicate transaction ID in user export: ${dup.tx.transactionId}`,
        score: 0,
        userTransaction: this.formatTxPayload(dup.tx, dup.rawRowIndex),
        exchangeTransaction: null
      });
    });

    // Record Duplicate Exchange Transactions as Unmatched
    duplicateExchangeTxs.forEach((dup) => {
      results.push({
        status: MATCH_STATUS.UNMATCHED,
        reason: `Duplicate transaction ID in exchange export: ${dup.tx.transactionId}`,
        score: 0,
        userTransaction: null,
        exchangeTransaction: this.formatTxPayload(dup.tx, dup.rawRowIndex)
      });
    });

    // Compute Summary Statistics
    const summary = {
      matched: results.filter(r => r.status === MATCH_STATUS.MATCHED).length,
      conflicting: results.filter(r => r.status === MATCH_STATUS.CONFLICTING).length,
      unmatchedUser: results.filter(r => r.status === MATCH_STATUS.UNMATCHED && r.userTransaction && !r.exchangeTransaction).length,
      unmatchedExchange: results.filter(r => r.status === MATCH_STATUS.UNMATCHED && !r.userTransaction && r.exchangeTransaction).length
    };

    return {
      results,
      summary
    };
  }

  formatTxPayload(tx, rowIndex) {
    if (!tx) return null;
    return {
      transactionId: tx.transactionId,
      timestamp: tx.timestamp,
      type: tx.type,
      asset: tx.asset,
      quantity: tx.quantity,
      priceUsd: tx.priceUsd,
      fee: tx.fee,
      note: tx.note,
      rawRowIndex: rowIndex
    };
  }
}

module.exports = new MatchingEngine();
