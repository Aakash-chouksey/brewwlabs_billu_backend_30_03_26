const Joi = require('joi');
const createHttpError = require('http-errors');

/**
 * Input Validation Schemas
 * Provides standardized validation for authentication inputs
 */

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Password requirements
const PASSWORD_REQUIREMENTS = {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?'
};

// Common validation schemas
const schemas = {
    // Login validation
    login: Joi.object({
        email: Joi.string()
            .email()
            .required()
            .messages({
                'string.email': 'Please provide a valid email address',
                'any.required': 'Email is required'
            }),
        password: Joi.string()
            .min(1)
            .max(128)
            .required()
            .messages({
                'string.min': 'Password cannot be empty',
                'string.max': 'Password is too long',
                'any.required': 'Password is required'
            }),
        latitude: Joi.number()
            .min(-90)
            .max(90)
            .optional()
            .messages({
                'number.min': 'Latitude must be between -90 and 90',
                'number.max': 'Latitude must be between -90 and 90'
            }),
        longitude: Joi.number()
            .min(-180)
            .max(180)
            .optional()
            .messages({
                'number.min': 'Longitude must be between -180 and 180',
                'number.max': 'Longitude must be between -180 and 180'
            })
    }),

    // User registration/onboarding validation
    registration: Joi.object({
        businessName: Joi.string()
            .min(2)
            .max(100)
            .required()
            .messages({
                'string.min': 'Business name must be at least 2 characters',
                'string.max': 'Business name cannot exceed 100 characters',
                'any.required': 'Business name is required'
            }),
        businessEmail: Joi.string()
            .email()
            .required()
            .messages({
                'string.email': 'Please provide a valid business email',
                'any.required': 'Business email is required'
            }),
        adminName: Joi.string()
            .min(2)
            .max(50)
            .required()
            .messages({
                'string.min': 'Admin name must be at least 2 characters',
                'string.max': 'Admin name cannot exceed 50 characters',
                'any.required': 'Admin name is required'
            }),
        adminEmail: Joi.string()
            .email()
            .required()
            .messages({
                'string.email': 'Please provide a valid admin email',
                'any.required': 'Admin email is required'
            }),
        adminPassword: Joi.string()
            .min(PASSWORD_REQUIREMENTS.minLength)
            .max(PASSWORD_REQUIREMENTS.maxLength)
            .required()
            .messages({
                'string.min': `Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters`,
                'string.max': `Password cannot exceed ${PASSWORD_REQUIREMENTS.maxLength} characters`,
                'any.required': 'Password is required'
            }),
        businessPhone: Joi.string()
            .pattern(/^[+]?[\d\s\-\(\)]+$/)
            .min(10)
            .max(20)
            .required()
            .messages({
                'string.pattern.base': 'Please provide a valid phone number',
                'string.min': 'Phone number must be at least 10 digits',
                'string.max': 'Phone number cannot exceed 20 characters',
                'any.required': 'Business phone is required'
            }),
        businessAddress: Joi.string()
            .min(5)
            .max(200)
            .required()
            .messages({
                'string.min': 'Address must be at least 5 characters',
                'string.max': 'Address cannot exceed 200 characters',
                'any.required': 'Business address is required'
            }),
        cafeType: Joi.string()
            .valid('SOLO', 'FRANCHISE')
            .default('SOLO')
            .messages({
                'any.only': 'Cafe type must be either SOLO or FRANCHISE'
            }),
        brandName: Joi.string()
            .min(2)
            .max(100)
            .optional()
            .messages({
                'string.min': 'Brand name must be at least 2 characters',
                'string.max': 'Brand name cannot exceed 100 characters'
            })
    }),

    // OTP validation
    otp: Joi.object({
        email: Joi.string()
            .email()
            .required()
            .messages({
                'string.email': 'Please provide a valid email address',
                'any.required': 'Email is required'
            }),
        otp: Joi.string()
            .pattern(/^\d{6}$/)
            .required()
            .messages({
                'string.pattern.base': 'OTP must be a 6-digit number',
                'any.required': 'OTP is required'
            })
    }),

    // Password change validation
    passwordChange: Joi.object({
        currentPassword: Joi.string()
            .min(1)
            .required()
            .messages({
                'any.required': 'Current password is required'
            }),
        newPassword: Joi.string()
            .min(PASSWORD_REQUIREMENTS.minLength)
            .max(PASSWORD_REQUIREMENTS.maxLength)
            .required()
            .messages({
                'string.min': `New password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters`,
                'string.max': `New password cannot exceed ${PASSWORD_REQUIREMENTS.maxLength} characters`,
                'any.required': 'New password is required'
            }),
        confirmPassword: Joi.string()
            .valid(Joi.ref('newPassword'))
            .required()
            .messages({
                'any.only': 'Password confirmation does not match',
                'any.required': 'Password confirmation is required'
            })
    }),

    // Email validation (for password reset, etc.)
    email: Joi.object({
        email: Joi.string()
            .email()
            .required()
            .messages({
                'string.email': 'Please provide a valid email address',
                'any.required': 'Email is required'
            })
    })
};

/**
 * Password strength validation
 */
const validatePasswordStrength = (password) => {
    const errors = [];
    
    if (password.length < PASSWORD_REQUIREMENTS.minLength) {
        errors.push(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters`);
    }
    
    if (password.length > PASSWORD_REQUIREMENTS.maxLength) {
        errors.push(`Password cannot exceed ${PASSWORD_REQUIREMENTS.maxLength} characters`);
    }
    
    if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }
    
    if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }
    
    if (PASSWORD_REQUIREMENTS.requireNumbers && !/\d/.test(password)) {
        errors.push('Password must contain at least one number');
    }
    
    if (PASSWORD_REQUIREMENTS.requireSpecialChars) {
        const specialCharRegex = new RegExp(`[${PASSWORD_REQUIREMENTS.specialChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`);
        if (!specialCharRegex.test(password)) {
            errors.push(`Password must contain at least one special character (${PASSWORD_REQUIREMENTS.specialChars})`);
        }
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Validation middleware factory
 */
const validate = (schemaName) => {
    return (req, res, next) => {
        const schema = schemas[schemaName];
        if (!schema) {
            return next(createHttpError(500, `Validation schema '${schemaName}' not found`));
        }

        const { error, value } = schema.validate(req.body, {
            abortEarly: false, // Return all validation errors
            stripUnknown: true // Remove unknown fields
        });

        if (error) {
            const validationErrors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                value: detail.context?.value
            }));

            console.warn(`❌ Validation failed for ${schemaName}:`, validationErrors);
            
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: validationErrors
            });
        }

        // Additional password strength validation for account creation/change (not login)
        const passwordToStrengthCheck = value.newPassword || value.adminPassword;
        if (passwordToStrengthCheck) {
            const strengthCheck = validatePasswordStrength(passwordToStrengthCheck);
            
            if (!strengthCheck.isValid) {
                return res.status(400).json({
                    success: false,
                    message: 'Password does not meet security requirements',
                    errors: strengthCheck.errors.map(err => ({ field: 'password', message: err }))
                });
            }
        }

        // Replace request body with validated and cleaned data
        req.body = value;
        next();
    };
};

/**
 * Sanitize email addresses
 */
const sanitizeEmail = (email) => {
    if (!email || typeof email !== 'string') return email;
    
    return email.toLowerCase().trim();
};

/**
 * Sanitize phone numbers
 */
const sanitizePhone = (phone) => {
    if (!phone || typeof phone !== 'string') return phone;
    
    // Remove all non-digit characters except +
    return phone.replace(/[^\d+]/g, '');
};

/**
 * Business logic validation
 */
const businessValidators = {
    // Validate business email doesn't match admin email (unless intended)
    validateEmailSeparation: (businessEmail, adminEmail) => {
        if (sanitizeEmail(businessEmail) === sanitizeEmail(adminEmail)) {
            throw createHttpError(400, 'Business email and admin email should be different for security');
        }
    },

    // Validate phone number format and region
    validatePhoneNumber: (phone) => {
        const sanitized = sanitizePhone(phone);
        
        // Basic validation - can be enhanced with country-specific rules
        if (!sanitized.match(/^\+?\d{10,15}$/)) {
            throw createHttpError(400, 'Invalid phone number format');
        }
        
        return sanitized;
    },

    // Validate business name uniqueness (would need database check)
    async validateBusinessNameUniqueness(businessName, excludeId = null) {
        // This would require database access - implement as needed
        // For now, just basic format validation
        if (!businessName || businessName.trim().length < 2) {
            throw createHttpError(400, 'Business name is too short');
        }
    }
};

module.exports = {
    schemas,
    validate,
    validatePasswordStrength,
    sanitizeEmail,
    sanitizePhone,
    businessValidators,
    PASSWORD_REQUIREMENTS
};
