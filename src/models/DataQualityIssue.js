const mongoose = require('mongoose');

const DataQualityIssueSchema = new mongoose.Schema({
  runId: {
    type: String,
    required: true,
    index: true
  },
  source: {
    type: String,
    enum: ['USER', 'EXCHANGE'],
    required: true
  },
  rowIndex: {
    type: Number,
    required: true
  },
  rawRow: {
    type: mongoose.Schema.Types.Mixed
  },
  reason: {
    type: String,
    required: true
  },
  severity: {
    type: String,
    enum: ['ERROR', 'WARNING'],
    default: 'ERROR'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('DataQualityIssue', DataQualityIssueSchema);
