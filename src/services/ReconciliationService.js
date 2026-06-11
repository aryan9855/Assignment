const { RUN_STATUS } = require('../constants');
const runRepo = require('../repositories/RunRepository');
const { userTransactionRepo, exchangeTransactionRepo } = require('../repositories/TransactionRepository');
const resultRepo = require('../repositories/ResultRepository');
const qualityIssueRepo = require('../repositories/QualityIssueRepository');
const csvParserService = require('./CSVParserService');
const matchingEngine = require('./MatchingEngine');

class ReconciliationService {
  /**
   * Run transaction reconciliation pipeline
   * @param {string} runId Unique identifier for this run
   * @param {Buffer} userFileBuffer File buffer for user transactions
   * @param {Buffer} exchangeFileBuffer File buffer for exchange transactions
   * @param {Object} configOverrides Configuration overrides for matching tolerances
   */
  async runReconciliation(runId, userFileBuffer, exchangeFileBuffer, configOverrides = {}) {
    // 1. Idempotency Check: check if run already exists
    const existingRun = await runRepo.findByRunId(runId);
    if (existingRun) {
      if (existingRun.status === RUN_STATUS.PROCESSING || existingRun.status === RUN_STATUS.PENDING) {
        const err = new Error(`Reconciliation run ${runId} is currently in progress.`);
        err.status = 409;
        throw err;
      }
      // Return existing completed/failed run directly (Idempotent)
      return { isExisting: true, run: existingRun };
    }

    // Set configuration parameters
    const timestampToleranceSeconds = configOverrides.timestampToleranceSeconds !== undefined
      ? configOverrides.timestampToleranceSeconds
      : require('../config').TIMESTAMP_TOLERANCE_SECONDS;

    const quantityTolerancePct = configOverrides.quantityTolerancePct !== undefined
      ? configOverrides.quantityTolerancePct
      : require('../config').QUANTITY_TOLERANCE_PCT;

    // 2. Initialize Run
    const run = await runRepo.create({
      runId,
      status: RUN_STATUS.PENDING,
      config: {
        timestampToleranceSeconds,
        quantityTolerancePct
      },
      auditTrail: [
        { action: 'RUN_INITIATED', details: `Reconciliation started with timestampTolerance=${timestampToleranceSeconds}s and quantityTolerance=${quantityTolerancePct * 100}%` }
      ]
    });

    try {
      // 3. Parse and Ingest files
      await runRepo.addAuditLog(runId, 'DATA_INGESTION_STARTED', 'Parsing user and exchange CSV exports');
      
      const [userTransactions, exchangeTransactions] = await Promise.all([
        csvParserService.parseTransactions(userFileBuffer, runId, 'USER'),
        csvParserService.parseTransactions(exchangeFileBuffer, runId, 'EXCHANGE')
      ]);

      const totalDataQualityIssues = await qualityIssueRepo.countDocuments({ runId });

      await runRepo.addAuditLog(
        runId,
        'DATA_INGESTION_COMPLETED',
        `Parsed ${userTransactions.length} valid user rows, ${exchangeTransactions.length} valid exchange rows. Detected ${totalDataQualityIssues} quality issues.`
      );

      // Save valid parsed transactions to DB
      await Promise.all([
        userTransactions.length > 0 ? userTransactionRepo.insertMany(userTransactions) : Promise.resolve(),
        exchangeTransactions.length > 0 ? exchangeTransactionRepo.insertMany(exchangeTransactions) : Promise.resolve()
      ]);

      // 4. Update status to PROCESSING
      await runRepo.updateStatus(runId, RUN_STATUS.PROCESSING);

      // 5. Match Engine Exec
      await runRepo.addAuditLog(runId, 'MATCHING_STARTED', 'Running scoring-based transaction pairing algorithm');
      
      const { results, summary } = matchingEngine.match(
        userTransactions,
        exchangeTransactions,
        { timestampToleranceSeconds, quantityTolerancePct }
      );

      // 6. Save results to DB
      if (results.length > 0) {
        const resultsWithRunId = results.map(r => ({ ...r, runId }));
        await resultRepo.insertMany(resultsWithRunId);
      }

      // 7. Complete Run
      const finalSummary = {
        ...summary,
        totalUserTransactions: userTransactions.length,
        totalExchangeTransactions: exchangeTransactions.length,
        totalDataQualityIssues
      };

      const updatedRun = await runRepo.updateOne(
        { runId },
        {
          $set: {
            status: RUN_STATUS.COMPLETED,
            summary: finalSummary,
            completedAt: new Date()
          },
          $push: {
            auditTrail: { action: 'RUN_COMPLETED', details: `Matched: ${summary.matched}, Conflicting: ${summary.conflicting}, Unmatched User: ${summary.unmatchedUser}, Unmatched Exchange: ${summary.unmatchedExchange}` }
          }
        },
        { new: true }
      );

      // Fetch fresh run doc for returns
      const finalRun = await runRepo.findByRunId(runId);
      return { isExisting: false, run: finalRun };
    } catch (error) {
      // 8. Handle Failures
      await runRepo.updateOne(
        { runId },
        {
          $set: {
            status: RUN_STATUS.FAILED,
            errorMessage: error.message,
            completedAt: new Date()
          },
          $push: {
            auditTrail: { action: 'RUN_FAILED', details: `Error: ${error.message}` }
          }
        }
      );
      throw error;
    }
  }
}

module.exports = new ReconciliationService();
