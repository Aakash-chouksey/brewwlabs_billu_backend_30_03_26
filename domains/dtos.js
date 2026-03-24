/**
 * DATA TRANSFER OBJECTS (DTOs)
 * 
 * Defines data contracts for all API operations
 * Ensures type safety and validation at system boundaries
 */

// ==================== AUTH DTOs ====================

class LoginInput {
  constructor(data) {
    this.email = data.email?.toLowerCase().trim();
    this.password = data.password;
    this.deviceInfo = data.deviceInfo || {};
  }

  validate() {
    const errors = [];
    if (!this.email || !this.email.includes('@')) {
      errors.push('Valid email is required');
    }
    if (!this.password || this.password.length < 6) {
      errors.push('Password must be at least 6 characters');
    }
    return { isValid: errors.length === 0, errors };
  }
}

class CreateUserInput {
  constructor(data) {
    this.name = data.name?.trim();
    this.email = data.email?.toLowerCase().trim();
    this.password = data.password;
    this.role = data.role || 'STAFF';
    this.businessId = data.businessId;
    this.outletId = data.outletId;
    this.phone = data.phone;
  }

  validate() {
    const errors = [];
    if (!this.name || this.name.length < 2) {
      errors.push('Name must be at least 2 characters');
    }
    if (!this.email || !this.email.includes('@')) {
      errors.push('Valid email is required');
    }
    if (!this.password || this.password.length < 8) {
      errors.push('Password must be at least 8 characters');
    }
    if (!this.businessId) {
      errors.push('Business ID is required');
    }
    return { isValid: errors.length === 0, errors };
  }
}

class OnboardingInput {
  constructor(data) {
    this.businessName = data.businessName?.trim();
    this.businessEmail = data.businessEmail?.toLowerCase().trim();
    this.businessPhone = data.businessPhone?.trim();
    this.businessAddress = data.businessAddress?.trim();
    this.gstNumber = data.gstNumber?.trim();
    this.adminName = data.adminName?.trim();
    this.adminEmail = data.adminEmail?.toLowerCase().trim();
    this.adminPassword = data.adminPassword;
    this.cafeType = data.cafeType || 'SOLO';
    this.brandName = data.brandName?.trim();
  }

  validate() {
    const errors = [];
    
    // Business validation
    if (!this.businessName || this.businessName.length < 2) {
      errors.push('Business name must be at least 2 characters');
    }
    if (!this.businessEmail || !this.businessEmail.includes('@')) {
      errors.push('Valid business email is required');
    }
    if (!this.businessPhone || this.businessPhone.length < 10) {
      errors.push('Valid business phone is required (min 10 digits)');
    }
    
    // Admin validation
    if (!this.adminName || this.adminName.length < 2) {
      errors.push('Admin name must be at least 2 characters');
    }
    if (!this.adminEmail || !this.adminEmail.includes('@')) {
      errors.push('Valid admin email is required');
    }
    if (!this.adminPassword || this.adminPassword.length < 8) {
      errors.push('Password must be at least 8 characters');
    } else {
      const hasUpperCase = /[A-Z]/.test(this.adminPassword);
      const hasLowerCase = /[a-z]/.test(this.adminPassword);
      const hasNumbers = /\d/.test(this.adminPassword);
      const hasSpecial = /\W/.test(this.adminPassword);
      if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecial) {
        errors.push('Password must contain uppercase, lowercase, number, and special character');
      }
    }
    
    return { isValid: errors.length === 0, errors };
  }
}

// ==================== RESPONSE DTOs ====================

class AuthResponse {
  constructor(data) {
    this.success = data.success !== false;
    this.user = data.user || null;
    this.accessToken = data.accessToken || null;
    this.refreshToken = data.refreshToken || null;
    this.message = data.message || '';
    this.error = data.error || null;
  }

  static success(user, tokens, message = 'Success') {
    return new AuthResponse({
      success: true,
      user,
      accessToken: tokens?.accessToken,
      refreshToken: tokens?.refreshToken,
      message
    });
  }

  static error(errorMessage, statusCode = 400) {
    return new AuthResponse({
      success: false,
      error: errorMessage,
      message: errorMessage
    });
  }
}

class BusinessResponse {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.email = data.email;
    this.status = data.status;
    this.type = data.type;
  }
}

class UserResponse {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.email = data.email;
    this.role = data.role;
    this.businessId = data.businessId;
    this.outletId = data.outletId;
    this.panelType = data.panelType;
    this.isActive = data.isActive;
    this.lastLogin = data.lastLogin;
  }
}

// ==================== ORDER DTOs ====================

class CreateOrderInput {
  constructor(data) {
    this.customerId = data.customerId;
    this.tableId = data.tableId;
    this.items = data.items || [];
    this.type = data.type || 'DINE_IN';
    this.notes = data.notes;
    this.discount = parseFloat(data.discount) || 0;
    this.tax = parseFloat(data.tax) || 0;
  }

  validate() {
    const errors = [];
    if (!this.items || !Array.isArray(this.items) || this.items.length === 0) {
      errors.push('Order must have at least one item');
    } else {
      this.items.forEach((item, index) => {
        if (!item.productId) {
          errors.push(`Item ${index + 1}: Product ID is required`);
        }
        if (!item.quantity || item.quantity <= 0) {
          errors.push(`Item ${index + 1}: Valid quantity is required`);
        }
      });
    }
    return { isValid: errors.length === 0, errors };
  }
}

// ==================== INVENTORY DTOs ====================

class InventoryItemInput {
  constructor(data) {
    this.productId = data.productId;
    this.quantity = parseInt(data.quantity);
    this.unitCost = parseFloat(data.unitCost) || 0;
    this.type = data.type || 'PURCHASE';
    this.notes = data.notes;
    this.location = data.location;
  }

  validate() {
    const errors = [];
    if (!this.productId) {
      errors.push('Product ID is required');
    }
    if (!this.quantity || this.quantity <= 0) {
      errors.push('Valid quantity is required');
    }
    return { isValid: errors.length === 0, errors };
  }
}

module.exports = {
  // Auth DTOs
  LoginInput,
  CreateUserInput,
  OnboardingInput,
  
  // Response DTOs
  AuthResponse,
  BusinessResponse,
  UserResponse,
  
  // Order DTOs
  CreateOrderInput,
  
  // Inventory DTOs
  InventoryItemInput
};
