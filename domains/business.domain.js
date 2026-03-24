/**
 * BUSINESS DOMAIN
 * 
 * Domain model for Business/Tenant entity
 */

const { BUSINESS_STATUS, TENANT_TYPES } = require('./domain.config');

class BusinessDomain {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.email = data.email;
    this.phone = data.phone;
    this.address = data.address;
    this.gstNumber = data.gstNumber;
    this.status = data.status || BUSINESS_STATUS.PENDING_APPROVAL;
    this.type = data.type || 'SOLO';
    this.isActive = data.isActive !== false;
    this.settings = data.settings || {};
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  /**
   * Check if business is active and approved
   */
  isOperational() {
    return this.isActive && this.status === BUSINESS_STATUS.ACTIVE;
  }

  /**
   * Check if business is pending approval
   */
  isPendingApproval() {
    return this.status === BUSINESS_STATUS.PENDING_APPROVAL;
  }

  /**
   * Get tenant type for this business
   */
  getTenantType() {
    return TENANT_TYPES.TENANT;
  }

  /**
   * Validate GST number format
   */
  static validateGST(gstNumber) {
    // Indian GST format: 15 characters (22AAAAA0000A1Z5)
    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return gstRegex.test(gstNumber);
  }

  /**
   * Create from database record
   */
  static fromDatabase(record) {
    return new BusinessDomain(record);
  }

  /**
   * Convert to database format
   */
  toDatabase() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      phone: this.phone,
      address: this.address,
      gstNumber: this.gstNumber,
      status: this.status,
      type: this.type,
      isActive: this.isActive,
      settings: this.settings
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
      phone: this.phone,
      address: this.address,
      gstNumber: this.gstNumber,
      status: this.status,
      type: this.type,
      isActive: this.isActive,
      settings: this.settings
    };
  }
}

module.exports = { BusinessDomain };
