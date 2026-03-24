/**
 * REPOSITORY INDEX
 * 
 * Centralized repository factory
 * Ensures consistent repository instantiation with proper dependencies
 */

const { controlPlaneSequelize } = require('../config/control_plane_db');

// Repository classes
const { UserRepository } = require('./user.repository');
const { BusinessRepository } = require('./business.repository');

class RepositoryFactory {
  constructor() {
    this.repositories = new Map();
    this.userRepository = new UserRepository();
    this.businessRepository = new BusinessRepository();
  }

  /**
   * Get UserRepository singleton
   */
  getUserRepository() {
    return this.userRepository;
  }

  /**
   * Get BusinessRepository singleton
   */
  getBusinessRepository() {
    return this.businessRepository;
  }

  /**
   * Clear all (No-op in new pattern)
   */
  clear() {}
}

// Export singleton
module.exports = new RepositoryFactory();
