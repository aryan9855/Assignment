const mongoose = require('mongoose');
const { MATCH_STATUS } = require('../constants');

const TransactionDetailsSchema = new mongoose.Schema({
  transactionId: { type: String },
  timestamp: { type: Date },
  type: { type: String },
  asset: { type: String },
  quantity: { type: Number },
  priceUsd: { type: Number },
  fee: { type: Number },
  note: { type: String },
  rawRowIndex: { type: Number }
}, { _id: false });

const ReconciliationResultSchema = new mongoose.Schema({
  runId: {
    type: String,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: Object.values(MATCH_STATUS),
    required: true,
    index: true
  },
  reason: {
    type: String,
    required: true
  },
  score: {
    type: Number,
    required: true
  },
  userTransaction: {
    type: TransactionDetailsSchema,
    default: null
  },
  exchangeTransaction: {
    type: TransactionDetailsSchema,
    default: null
  },
  discrepancies: {
    quantityDiff: Number,
    quantityDiffPct: Number,
    timeDiffSeconds: Number
  }
}, {
  timestamps: true
});

// Compound index for filtering/sorting reports
ReconciliationResultSchema.index({ runId: 1, status: 1 });

module.exports = mongoose.model('ReconciliationResult', ReconciliationResultSchema);
