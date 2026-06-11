const BaseRepository = require('./BaseRepository');
const DataQualityIssue = require('../models/DataQualityIssue');

class QualityIssueRepository extends BaseRepository {
  constructor() {
    super(DataQualityIssue);
  }

  async getIssuesByRunId(runId) {
    return this.find({ runId });
  }
}

module.exports = new QualityIssueRepository();
