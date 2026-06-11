const express = require('express');
const multer = require('multer');
const reconcileController = require('../controllers/ReconcileController');
const reportController = require('../controllers/ReportController');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Upload fields mapping
const uploadFields = upload.fields([
  { name: 'userFile', maxCount: 1 },
  { name: 'exchangeFile', maxCount: 1 }
]);

// Trigger reconciliation run
router.post('/reconcile', uploadFields, reconcileController.reconcile);

// Report endpoints
router.get('/report/:runId', reportController.getReport);
router.get('/report/:runId/summary', reportController.getSummary);
router.get('/report/:runId/unmatched', reportController.getUnmatched);

module.exports = router;
