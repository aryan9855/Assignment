const reconciliationService = require('../services/ReconciliationService');

class ReconcileController {
  async reconcile(req, res, next) {
    try {
      const files = req.files;
      if (!files || !files.userFile || !files.exchangeFile) {
        return res.status(400).json({
          success: false,
          message: 'Both "userFile" and "exchangeFile" CSV uploads are required.'
        });
      }

      const userFile = files.userFile[0];
      const exchangeFile = files.exchangeFile[0];

      // Read parameters from body or use defaults
      const runId = req.body.runId || `RUN_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
      
      const configOverrides = {};
      if (req.body.timestampToleranceSeconds !== undefined) {
        const seconds = parseInt(req.body.timestampToleranceSeconds, 10);
        if (!isNaN(seconds) && seconds >= 0) {
          configOverrides.timestampToleranceSeconds = seconds;
        }
      }

      if (req.body.quantityTolerancePct !== undefined) {
        const pct = parseFloat(req.body.quantityTolerancePct);
        if (!isNaN(pct) && pct >= 0) {
          configOverrides.quantityTolerancePct = pct;
        }
      }

      const { isExisting, run } = await reconciliationService.runReconciliation(
        runId,
        userFile.buffer,
        exchangeFile.buffer,
        configOverrides
      );

      const statusCode = isExisting ? 200 : 201;
      const message = isExisting
        ? 'Reconciliation run already exists. Returning previously computed run.'
        : 'Reconciliation run completed successfully.';

      return res.status(statusCode).json({
        success: true,
        message,
        data: run
      });
    } catch (error) {
      if (error.status === 409) {
        return res.status(409).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }
}

module.exports = new ReconcileController();
