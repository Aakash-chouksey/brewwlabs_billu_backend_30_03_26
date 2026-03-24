/**
 * USER REPOSITORY
 * 
 * Handles all User database operations
 * ENFORCES: Transaction-safe queries only
 * NO direct model access outside this repository
 */

const { BaseRepository } = require('./base.repository');
const { UserDomain } = require('../domains/user.domain');
const { CONTROL_PLANE } = require('../src/utils/constants');

class UserRepository extends BaseRepository {
  constructor() {
    super('User');
  }

  /**
   * Helper to ensure CONTROL_PLANE context
   */
  _options(options) {
    return { ...options, tenantId: CONTROL_PLANE };
  }

  /**
   * Find user by email
   * @param {string} email - User email
   * @param {Object} options - Must include transaction
   */
  async findByEmail(email, options = {}) {
    const { transaction } = options;
    this._validateTransaction(transaction);

    const user = await this.findOne(this._options({
      where: { email: email.toLowerCase() },
      transaction
    }));

    return user ? UserDomain.fromDatabase(user.toJSON()) : null;
  }

  /**
   * Find user by ID
   * @param {string} id - User ID
   * @param {Object} options - Must include transaction
   */
  async findById(id, options = {}) {
    const { transaction } = options;
    this._validateTransaction(transaction);

    const user = await super.findById(id, this._options({ transaction }));
    return user ? UserDomain.fromDatabase(user.toJSON()) : null;
  }

  /**
   * Create new user
   * @param {Object} data - User data
   * @param {Object} options - Must include transaction
   */
  async create(data, options = {}) {
    const { transaction } = options;
    this._validateTransaction(transaction);

    const user = await super.create(data, this._options({ transaction }));
    return UserDomain.fromDatabase(user.toJSON());
  }

  /**
   * Update user
   * @param {string} id - User ID
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
   * Update last login
   * @param {string} id - User ID
   * @param {Date} date - Login date
   * @param {Object} options - Must include transaction
   */
  async updateLastLogin(id, date = new Date(), options = {}) {
    const { transaction } = options;
    this._validateTransaction(transaction);

    return await this.update(id, { lastLogin: date }, { transaction });
  }

  /**
   * Increment token version
   * @param {string} id - User ID
   * @param {Object} options - Must include transaction
   */
  async incrementTokenVersion(id, options = {}) {
    const { transaction } = options;
    this._validateTransaction(transaction);

    const user = await this.findById(id, { transaction });
    if (!user) return null;

    const newVersion = (user.tokenVersion || 0) + 1;
    return await this.update(id, { tokenVersion: newVersion }, { transaction });
  }

  /**
   * Find users by business
   * @param {string} businessId - Business ID
   * @param {Object} options - Must include transaction
   */
  async findByBusiness(businessId, options = {}) {
    const { transaction } = options;
    this._validateTransaction(transaction);

    const users = await this.findAll(this._options({
      where: { businessId },
      transaction
    }));

    return users.map(u => UserDomain.fromDatabase(u.toJSON()));
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
}

module.exports = { UserRepository };
