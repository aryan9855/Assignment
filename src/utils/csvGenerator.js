/**
 * Helper to convert Reconciliation Results into flat CSV string
 * @param {Array} results List of reconciliation result documents
 * @returns {string} Raw CSV content
 */
function convertResultsToCSV(results) {
  const headers = [
    'user_transaction_id',
    'user_timestamp',
    'user_type',
    'user_asset',
    'user_quantity',
    'exchange_transaction_id',
    'exchange_timestamp',
    'exchange_type',
    'exchange_asset',
    'exchange_quantity',
    'status',
    'reason',
    'score'
  ];

  const rows = results.map(r => {
    const u = r.userTransaction || {};
    const e = r.exchangeTransaction || {};

    const columns = [
      u.transactionId || '',
      u.timestamp ? new Date(u.timestamp).toISOString() : '',
      u.type || '',
      u.asset || '',
      u.quantity !== undefined ? u.quantity : '',
      e.transactionId || '',
      e.timestamp ? new Date(e.timestamp).toISOString() : '',
      e.type || '',
      e.asset || '',
      e.quantity !== undefined ? e.quantity : '',
      r.status,
      // Wrap reason in quotes to handle commas
      r.reason ? `"${r.reason.replace(/"/g, '""')}"` : '',
      r.score
    ];

    return columns.join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

module.exports = {
  convertResultsToCSV
};
