const mongoose = require('mongoose');

const ExchangeTransactionSchema = new mongoose.Schema({
  runId: {
    type: String,
    required: true,
    index: true
  },
  transactionId: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    required: true
  },
  rawTimestamp: {
    type: String
  },
  type: {
    type: String,
    required: true
  },
  asset: {
    type: String,
    required: true
  },
  normalizedAsset: {
    type: String,
    required: true,
    index: true
  },
  quantity: {
    type: Number,
    required: true
  },
  priceUsd: {
    type: Number
  },
  fee: {
    type: Number
  },
  note: {
    type: String
  },
  isDuplicate: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Compound index to speed up lookup matching phase
ExchangeTransactionSchema.index({ runId: 1, normalizedAsset: 1, type: 1 });

module.exports = mongoose.model('ExchangeTransaction', ExchangeTransactionSchema);
