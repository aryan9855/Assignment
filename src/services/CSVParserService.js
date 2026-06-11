const { parse } = require('csv-parse');
const { ASSET_ALIASES, TRANSACTION_TYPES } = require('../constants');
const qualityIssueRepo = require('../repositories/QualityIssueRepository');

class CSVParserService {
  /**
   * Parses CSV transactions from a buffer, validates, normalizes, and logs quality issues.
   * @param {Buffer} fileBuffer 
   * @param {string} runId 
   * @param {'USER'|'EXCHANGE'} source 
   * @returns {Promise<Array<Object>>} List of valid, parsed transactions
   */
  async parseTransactions(fileBuffer, runId, source) {
    return new Promise((resolve, reject) => {
      const records = [];
      const parser = parse(fileBuffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true
      });

      const promises = [];
      let rowIndex = 1; // 1-based index (Header is 1)

      parser.on('readable', () => {
        let record;
        while ((record = parser.read()) !== null) {
          rowIndex++;
          const currentRowIndex = rowIndex;
          const currentRecord = { ...record };

          // Run validation
          const validationResult = this.validateRecord(currentRecord, currentRowIndex);

          if (validationResult.isValid) {
            records.push({
              runId,
              transactionId: validationResult.data.transactionId,
              timestamp: validationResult.data.timestamp,
              rawTimestamp: currentRecord.timestamp || '',
              type: validationResult.data.type,
              asset: validationResult.data.asset,
              normalizedAsset: validationResult.data.normalizedAsset,
              quantity: validationResult.data.quantity,
              priceUsd: validationResult.data.priceUsd,
              fee: validationResult.data.fee,
              note: currentRecord.note || ''
            });
          } else {
            // Asynchronously log data quality issue
            promises.push(
              qualityIssueRepo.create({
                runId,
                source,
                rowIndex: currentRowIndex,
                rawRow: currentRecord,
                reason: validationResult.reason
              })
            );
          }
        }
      });

      parser.on('error', (err) => {
        reject(new Error(`CSV Parsing failed: ${err.message}`));
      });

      parser.on('end', () => {
        // Wait for all quality issue logging to finish
        Promise.all(promises)
          .then(() => resolve(records))
          .catch(reject);
      });
    });
  }

  /**
   * Validates row fields
   */
  validateRecord(record, rowIndex) {
    const transactionId = record.transaction_id || record.transactionId;
    if (!transactionId) {
      return { isValid: false, reason: 'Missing transaction_id' };
    }

    const rawTimestamp = record.timestamp;
    if (!rawTimestamp) {
      return { isValid: false, reason: 'Missing timestamp' };
    }

    const timestamp = new Date(rawTimestamp);
    if (isNaN(timestamp.getTime())) {
      return { isValid: false, reason: `Malformed timestamp: "${rawTimestamp}"` };
    }

    const type = (record.type || '').toUpperCase();
    if (!Object.values(TRANSACTION_TYPES).includes(type)) {
      return { isValid: false, reason: `Invalid transaction type: "${record.type}"` };
    }

    const asset = record.asset;
    if (!asset) {
      return { isValid: false, reason: 'Missing asset field' };
    }

    // Normalize asset
    const rawAssetLower = asset.toLowerCase();
    const normalizedAsset = ASSET_ALIASES[rawAssetLower] || asset.toUpperCase();

    const quantityStr = record.quantity;
    if (quantityStr === undefined || quantityStr === '') {
      return { isValid: false, reason: 'Missing quantity field' };
    }

    const quantity = parseFloat(quantityStr);
    if (isNaN(quantity)) {
      return { isValid: false, reason: `Quantity is not a number: "${quantityStr}"` };
    }

    if (quantity <= 0) {
      return { isValid: false, reason: `Quantity must be positive: ${quantity}` };
    }

    const priceUsd = record.price_usd ? parseFloat(record.price_usd) : undefined;
    const fee = record.fee ? parseFloat(record.fee) : 0;

    return {
      isValid: true,
      data: {
        transactionId,
        timestamp,
        type,
        asset,
        normalizedAsset,
        quantity,
        priceUsd: isNaN(priceUsd) ? undefined : priceUsd,
        fee: isNaN(fee) ? 0 : fee
      }
    };
  }
}

module.exports = new CSVParserService();
