const mongoose = require('mongoose');
const { RUN_STATUS } = require('../constants');

const AuditTrailSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  action: { type: String, required: true },
  details: { type: String }
}, { _id: false });

const ReconciliationRunSchema = new mongoose.Schema({
  runId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  status: {
    type: String,
    enum: Object.values(RUN_STATUS),
    default: RUN_STATUS.PENDING,
    required: true
  },
  config: {
    timestampToleranceSeconds: { type: Number, required: true },
    quantityTolerancePct: { type: Number, required: true }
  },
  summary: {
    matched: { type: Number, default: 0 },
    conflicting: { type: Number, default: 0 },
    unmatchedUser: { type: Number, default: 0 },
    unmatchedExchange: { type: Number, default: 0 },
    totalUserTransactions: { type: Number, default: 0 },
    totalExchangeTransactions: { type: Number, default: 0 },
    totalDataQualityIssues: { type: Number, default: 0 }
  },
  errorMessage: { type: String },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  auditTrail: [AuditTrailSchema]
}, {
  timestamps: true
});

module.exports = mongoose.model('ReconciliationRun', ReconciliationRunSchema);
