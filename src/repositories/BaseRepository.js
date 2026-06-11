class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  async create(data) {
    return this.model.create(data);
  }

  async insertMany(dataArray) {
    return this.model.insertMany(dataArray);
  }

  async findById(id) {
    return this.model.findById(id);
  }

  async findOne(filter) {
    return this.model.findOne(filter);
  }

  async find(filter = {}, projection = {}, options = {}) {
    return this.model.find(filter, projection, options);
  }

  async updateOne(filter, update, options = {}) {
    return this.model.updateOne(filter, update, options);
  }

  async countDocuments(filter = {}) {
    return this.model.countDocuments(filter);
  }

  async deleteMany(filter = {}) {
    return this.model.deleteMany(filter);
  }
}

module.exports = BaseRepository;
