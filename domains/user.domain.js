/**
 * USER DOMAIN
 * 
 * Domain model for User entity with business logic
 * Pure logic - no database dependencies
 */

const { USER_ROLES, PANEL_TYPES } = require('./domain.config');

class UserDomain {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.email = data.email?.toLowerCase();
    this.role = data.role || USER_ROLES.STAFF;
    this.businessId = data.businessId;
    this.outletId = data.outletId;
    this.panelType = data.panelType || PANEL_TYPES.TENANT;
    this.isActive = data.isActive !== false;
    this.isVerified = data.isVerified !== false;
    this.tokenVersion = data.tokenVersion || 0;
    this.lastLogin = data.lastLogin;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  /**
   * Check if user has specific role
   */
  hasRole(role) {
    return this.role === role;
  }

  /**
   * Check if user is admin (any admin type)
   */
  isAdmin() {
    return this.role === USER_ROLES.SUPER_ADMIN || 
           this.role === USER_ROLES.BUSINESS_ADMIN;
  }
 
  /**
   * Check if user can access specific business
   */
  canAccessBusiness(businessId) {
    if (this.role === USER_ROLES.SUPER_ADMIN) return true;
    return this.businessId === businessId;
  }

  /**
   * Check if user account is active and verified
   */
  isAccountReady() {
    return this.isActive && this.isVerified;
  }

  /**
   * Validate password meets requirements
   */
  static validatePassword(password) {
    const errors = [];
    if (!password || password.length < 8) {
      errors.push('Password must be at least 8 characters');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    if (!/\W/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
    return { isValid: errors.length === 0, errors };
  }

  /**
   * Create user from database record
   */
  static fromDatabase(record) {
    return new UserDomain(record);
  }

  /**
   * Convert to database format
   */
  toDatabase() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      role: this.role,
      businessId: this.businessId,
      outletId: this.outletId,
      panelType: this.panelType,
      isActive: this.isActive,
      isVerified: this.isVerified,
      tokenVersion: this.tokenVersion,
      lastLogin: this.lastLogin
    };
  }

  /**
   * Convert to API response
   */
  toResponse() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      role: this.role,
      businessId: this.businessId,
      outletId: this.outletId,
      panelType: this.panelType,
      isActive: this.isActive,
      isVerified: this.isVerified,
      lastLogin: this.lastLogin
    };
  }
}

module.exports = { UserDomain };
