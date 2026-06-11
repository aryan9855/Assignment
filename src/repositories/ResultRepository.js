const BaseRepository = require('./BaseRepository');
const ReconciliationResult = require('../models/ReconciliationResult');

class ResultRepository extends BaseRepository {
  constructor() {
    super(ReconciliationResult);
  }

  async getPaginatedResults(runId, filters = {}, options = {}) {
    const { status } = filters;
    const { page = 1, limit = 50, sortBy = 'createdAt', sortOrder = 'asc' } = options;

    const query = { runId };
    if (status) {
      query.status = status;
    }

    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
    const skip = (page - 1) * limit;

    const docs = await this.model.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .exec();

    const total = await this.model.countDocuments(query);

    return {
      data: docs,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getCountsByRunId(runId) {
    const aggregation = await this.model.aggregate([
      { $match: { runId } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const counts = {
      MATCHED: 0,
      CONFLICTING: 0,
      UNMATCHED_USER: 0,
      UNMATCHED_EXCHANGE: 0
    };

    aggregation.forEach(group => {
      if (group._id === 'MATCHED') counts.MATCHED = group.count;
      else if (group._id === 'CONFLICTING') counts.CONFLICTING = group.count;
      else if (group._id === 'UNMATCHED') {
        // We need to count how many are user only vs exchange only
        // Let's query them specifically, or aggregation can sub-group by checking if userTransaction.transactionId exists
      }
    });

    // Let's do a more detailed aggregation to split unmatched user vs exchange
    const detailedAggregation = await this.model.aggregate([
      { $match: { runId } },
      {
        $group: {
          _id: {
            status: '$status',
            hasUser: { $cond: [{ $ifNull: ['$userTransaction.transactionId', false] }, true, false] },
            hasExchange: { $cond: [{ $ifNull: ['$exchangeTransaction.transactionId', false] }, true, false] }
          },
          count: { $sum: 1 }
        }
      }
    ]);

    detailedAggregation.forEach(group => {
      const { status, hasUser, hasExchange } = group._id;
      if (status === 'MATCHED') {
        counts.MATCHED = group.count;
      } else if (status === 'CONFLICTING') {
        counts.CONFLICTING = group.count;
      } else if (status === 'UNMATCHED') {
        if (hasUser && !hasExchange) {
          counts.UNMATCHED_USER = group.count;
        } else if (!hasUser && hasExchange) {
          counts.UNMATCHED_EXCHANGE = group.count;
        }
      }
    });

    return counts;
  }
}

module.exports = new ResultRepository();
