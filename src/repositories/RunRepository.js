const BaseRepository = require('./BaseRepository');
const ReconciliationRun = require('../models/ReconciliationRun');

class RunRepository extends BaseRepository {
  constructor() {
    super(ReconciliationRun);
  }

  async findByRunId(runId) {
    return this.findOne({ runId });
  }

  async updateStatus(runId, status, extraFields = {}) {
    return this.updateOne(
      { runId },
      { $set: { status, ...extraFields } }
    );
  }

  async addAuditLog(runId, action, details) {
    return this.updateOne(
      { runId },
      { $push: { auditTrail: { action, details } } }
    );
  }
}

module.exports = new RunRepository();
