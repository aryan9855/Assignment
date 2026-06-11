const BaseRepository = require('./BaseRepository');
const UserTransaction = require('../models/UserTransaction');
const ExchangeTransaction = require('../models/ExchangeTransaction');

class UserTransactionRepository extends BaseRepository {
  constructor() {
    super(UserTransaction);
  }

  async getTransactionsByRunId(runId) {
    return this.find({ runId });
  }
}

class ExchangeTransactionRepository extends BaseRepository {
  constructor() {
    super(ExchangeTransaction);
  }

  async getTransactionsByRunId(runId) {
    return this.find({ runId });
  }
}

module.exports = {
  userTransactionRepo: new UserTransactionRepository(),
  exchangeTransactionRepo: new ExchangeTransactionRepository()
};
