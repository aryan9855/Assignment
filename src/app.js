const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes/api');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root endpoint - API documentation
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'Transaction Reconciliation Engine',
    version: '1.0.0',
    description: 'A scoring-based transaction reconciliation engine that matches user-exported transactions against exchange-exported transactions.',
    status: 'UP',
    endpoints: {
      'POST /api/reconcile': 'Upload user & exchange CSV files to run reconciliation. Optional body params: timestampToleranceSeconds, quantityTolerancePct',
      'GET /api/report/:runId': 'Get full reconciliation report for a run',
      'GET /api/report/:runId/summary': 'Get summary statistics for a run',
      'GET /api/report/:runId/unmatched': 'Get unmatched transactions for a run',
      'GET /health': 'Health check'
    },
    configuration: {
      TIMESTAMP_TOLERANCE_SECONDS: 'Default: 300 (configurable via env var or request body)',
      QUANTITY_TOLERANCE_PCT: 'Default: 0.01 (configurable via env var or request body)'
    }
  });
});

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date() });
});

// API Routes
app.use('/api', apiRoutes);

// Error Handler Middleware
app.use(errorHandler);

module.exports = app;
