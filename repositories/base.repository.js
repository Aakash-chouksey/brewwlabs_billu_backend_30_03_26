const { getModels } = require('../src/utils/modelHelper');
const { assertTransaction, assertTenant } = require('../src/utils/guards');

/**
 * BASE REPOSITORY - Absolute Safety Version
 */
class BaseRepository {
  constructor(modelName) {
    this.modelName = modelName;
  }

  /**
   * Resolve model from transaction context with validation
   */
  _getModel(transaction, tenantId) {
    assertTransaction(transaction);
    assertTenant(tenantId);

    const models = getModels(transaction);
    const Model = models[this.modelName];
    if (!Model) {
        throw new Error(`🚨 CRITICAL: Model ${this.modelName} not found.`);
    }
    return Model;
  }

  /**
   * Validate transaction is provided
   */
  _validateTransaction(transaction) {
    if (!transaction) {
      throw new Error(`🚨 CRITICAL: Transaction required for ${this.constructor.name} operations.`);
    }
  }

  // ==================== CRUD OPERATIONS (Hardened) ====================

  /**
   * Create new record
   */
  async create(data, options = {}) {
    const { transaction, tenantId, ...otherOptions } = options;
    const Model = this._getModel(transaction, tenantId);
    
    return await Model.create(data, {
      ...otherOptions,
      transaction
    });
  }

  /**
   * Find all records
   */
  async findAll(options = {}) {
    const { transaction, tenantId, ...otherOptions } = options;
    const Model = this._getModel(transaction, tenantId);
    
    return await Model.findAll({
      ...otherOptions,
      transaction
    });
  }

  /**
   * Find one record
   */
  async findOne(options = {}) {
    const { transaction, tenantId, ...otherOptions } = options;
    const Model = this._getModel(transaction, tenantId);
    
    return await Model.findOne({
      ...otherOptions,
      transaction
    });
  }

  /**
   * Find by ID
   */
  async findById(id, options = {}) {
    const { transaction, tenantId, ...otherOptions } = options;
    const Model = this._getModel(transaction, tenantId);
    
    return await Model.findByPk(id, {
      ...otherOptions,
      transaction
    });
  }

  /**
   * Update record
   */
  async update(data, options = {}) {
    const { transaction, tenantId, where, ...otherOptions } = options;
    const Model = this._getModel(transaction, tenantId);
    
    return await Model.update(data, {
      where,
      ...otherOptions,
      transaction
    });
  }

  /**
   * Delete record
   */
  async destroy(options = {}) {
    const { transaction, tenantId, where, ...otherOptions } = options;
    const Model = this._getModel(transaction, tenantId);
    
    return await Model.destroy({
      where,
      ...otherOptions,
      transaction
    });
  }

  /**
   * Count records
   */
  async count(options = {}) {
    const { transaction, tenantId, ...otherOptions } = options;
    const Model = this._getModel(transaction, tenantId);
    
    return await Model.count({
      ...otherOptions,
      transaction
    });
  }

  /**
   * Find or create
   */
  async findOrCreate(options = {}) {
    const { transaction, tenantId, where, defaults, ...otherOptions } = options;
    const Model = this._getModel(transaction, tenantId);
    
    return await Model.findOrCreate({
      where,
      defaults,
      ...otherOptions,
      transaction
    });
  }

  /**
   * Bulk create
   */
  async bulkCreate(records, options = {}) {
    const { transaction, tenantId, ...otherOptions } = options;
    const Model = this._getModel(transaction, tenantId);
    
    return await Model.bulkCreate(records, {
      ...otherOptions,
      transaction
    });
  }
}

module.exports = { BaseRepository };
