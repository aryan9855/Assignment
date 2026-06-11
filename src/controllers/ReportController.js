const runRepo = require('../repositories/RunRepository');
const resultRepo = require('../repositories/ResultRepository');
const { convertResultsToCSV } = require('../utils/csvGenerator');
const { MATCH_STATUS } = require('../constants');

class ReportController {
  /**
   * GET /report/:runId
   * Fetch full report with optional pagination, sorting, filtering, and format overrides
   */
  async getReport(req, res, next) {
    try {
      const { runId } = req.params;
      const { status, page, limit, sortBy, sortOrder, format } = req.query;

      const run = await runRepo.findByRunId(runId);
      if (!run) {
        return res.status(404).json({
          success: false,
          message: `Reconciliation run ${runId} not found.`
        });
      }

      // If format is CSV, fetch all records (no pagination) and stream as file download
      if (format === 'csv' || req.headers.accept === 'text/csv') {
        const allResults = await resultRepo.find({ runId });
        const csvContent = convertResultsToCSV(allResults);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=reconciliation_report_${runId}.csv`);
        return res.status(200).send(csvContent);
      }

      const paginationOptions = {
        page: parseInt(page, 10) || 1,
        limit: parseInt(limit, 10) || 50,
        sortBy: sortBy || 'createdAt',
        sortOrder: sortOrder || 'asc'
      };

      const filters = {};
      if (status) {
        const uppercaseStatus = status.toUpperCase();
        if (Object.values(MATCH_STATUS).includes(uppercaseStatus)) {
          filters.status = uppercaseStatus;
        }
      }

      const reportData = await resultRepo.getPaginatedResults(runId, filters, paginationOptions);

      return res.status(200).json({
        success: true,
        runDetails: {
          runId: run.runId,
          status: run.status,
          config: run.config,
          summary: run.summary,
          startedAt: run.startedAt,
          completedAt: run.completedAt
        },
        data: reportData.data,
        pagination: reportData.pagination
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /report/:runId/summary
   * Fetch summary counts and audit history
   */
  async getSummary(req, res, next) {
    try {
      const { runId } = req.params;

      const run = await runRepo.findByRunId(runId);
      if (!run) {
        return res.status(404).json({
          success: false,
          message: `Reconciliation run ${runId} not found.`
        });
      }

      // Calculate details via aggregation to ensure consistency
      const statusCounts = await resultRepo.getCountsByRunId(runId);

      return res.status(200).json({
        success: true,
        runId,
        status: run.status,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        config: run.config,
        summary: {
          totalUserTransactions: run.summary.totalUserTransactions,
          totalExchangeTransactions: run.summary.totalExchangeTransactions,
          totalDataQualityIssues: run.summary.totalDataQualityIssues,
          counts: statusCounts
        },
        auditTrail: run.auditTrail
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /report/:runId/unmatched
   * Fetch unmatched rows with reasons (paginated)
   */
  async getUnmatched(req, res, next) {
    try {
      const { runId } = req.params;
      const { page, limit, sortBy, sortOrder } = req.query;

      const run = await runRepo.findByRunId(runId);
      if (!run) {
        return res.status(404).json({
          success: false,
          message: `Reconciliation run ${runId} not found.`
        });
      }

      const paginationOptions = {
        page: parseInt(page, 10) || 1,
        limit: parseInt(limit, 10) || 50,
        sortBy: sortBy || 'createdAt',
        sortOrder: sortOrder || 'asc'
      };

      const reportData = await resultRepo.getPaginatedResults(
        runId,
        { status: MATCH_STATUS.UNMATCHED },
        paginationOptions
      );

      return res.status(200).json({
        success: true,
        runId,
        data: reportData.data,
        pagination: reportData.pagination
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ReportController();
