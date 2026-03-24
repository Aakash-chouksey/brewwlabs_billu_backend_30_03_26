/**
 * BUSINESS REPOSITORY
 * 
 * Handles all Business/Tenant database operations
 * ENFORCES: Transaction-safe queries only
 */

const { BaseRepository } = require('./base.repository');
const { BusinessDomain } = require('../domains/business.domain');
const { CONTROL_PLANE } = require('../src/utils/constants');

class BusinessRepository extends BaseRepository {
  constructor() {
    super('Business');
  }

  /**
   * Helper to ensure CONTROL_PLANE context
   */
  _options(options) {
    return { ...options, tenantId: CONTROL_PLANE };
  }

  /**
   * Find business by email
   * @param {string} email - Business email
   * @param {Object} options - Must include transaction
   */
  async findByEmail(email, options = {}) {
    const { transaction } = options;
    this._validateTransaction(transaction);

    const business = await this.findOne(this._options({
      where: { email: email.toLowerCase() },
      transaction
    }));

    return business ? BusinessDomain.fromDatabase(business.toJSON()) : null;
  }

  /**
   * Find business by ID
   * @param {string} id - Business ID
   * @param {Object} options - Must include transaction
   */
  async findById(id, options = {}) {
    const { transaction } = options;
    this._validateTransaction(transaction);

    const business = await super.findById(id, this._options({ transaction }));
    return business ? BusinessDomain.fromDatabase(business.toJSON()) : null;
  }

  /**
   * Create new business
   * @param {Object} data - Business data
   * @param {Object} options - Must include transaction
   */
  async create(data, options = {}) {
    const { transaction } = options;
    this._validateTransaction(transaction);

    const business = await super.create(data, this._options({ transaction }));
    return BusinessDomain.fromDatabase(business.toJSON());
  }

  /**
   * Update business
   * @param {string} id - Business ID
   * @param {Object} data - Update data
   * @param {Object} options - Must include transaction
   */
  async update(id, data, options = {}) {
    const { transaction } = options;
    this._validateTransaction(transaction);

    const [updated] = await super.update(data, this._options({
      where: { id },
      transaction
    }));

    if (updated === 0) {
      return null;
    }

    return await this.findById(id, { transaction });
  }

  /**
   * Check if email exists
   * @param {string} email - Email to check
   * @param {Object} options - Must include transaction
   */
  async emailExists(email, options = {}) {
    const { transaction } = options;
    this._validateTransaction(transaction);

    const count = await this.count(this._options({
      where: { email: email.toLowerCase() },
      transaction
    }));

    return count > 0;
  }

  /**
   * Find active businesses
   * @param {Object} options - Must include transaction
   */
  async findActive(options = {}) {
    const { transaction } = options;
    this._validateTransaction(transaction);

    const businesses = await this.findAll(this._options({
      where: { 
        isActive: true,
        status: 'ACTIVE'
      },
      transaction
    }));

    return businesses.map(b => BusinessDomain.fromDatabase(b.toJSON()));
  }
}

module.exports = { BusinessRepository };
