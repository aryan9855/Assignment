require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 5000,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/reconciliation_engine',
  TIMESTAMP_TOLERANCE_SECONDS: parseInt(process.env.TIMESTAMP_TOLERANCE_SECONDS, 10) || 300,
  QUANTITY_TOLERANCE_PCT: parseFloat(process.env.QUANTITY_TOLERANCE_PCT) || 0.01
};
