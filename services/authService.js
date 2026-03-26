const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// Import repositories (Data-First pattern)
const repositories = require('../repositories');
const { UserDomain } = require('../domains/user.domain');
const { TENANT_TYPES } = require('../domains/domain.config');
const { AuthResponse } = require('../domains/dtos');

// Import utilities
const neonTransactionSafeExecutor = require('./neonTransactionSafeExecutor');
const tokenService = require('./tokenService');
const { logAuthEvent } = require('../security/auditLogger');
const { getModels } = require('../src/utils/modelHelper');
const { CONTROL_PLANE } = require('../src/utils/constants');

/**
 * Auth Service - DATA-FIRST REFACTORED
 * 
 * CRITICAL: All database updates MUST use neonTransactionSafeExecutor.executeWithTenant()
 */
class AuthService {
    constructor() {
        this.issuer = 'brewwlabs-pos';
        this.audience = 'brewwlabs-pos-users';
    }

    /**
     * Login with email and password
     * ENFORCES: Transaction-safe lastLogin update
     * PATTERN: Service → Repository → DB
     */
    async login(email, password, options = {}) {
        try {
            // Get repository instance
            const userRepo = repositories.getUserRepository();
            
            console.log(`🔍 [LOGIN DEBUG] Attempting login for: ${email}`);
            
            // Use control_plane context for user authentication
            const result = await neonTransactionSafeExecutor.executeForAuth(
                async (context) => {
                    const transaction = context.transaction;
                    const { User, SuperAdminUser } = context.transactionModels;

                    console.log(`🔍 [LOGIN DEBUG] Models available: User=${!!User}, SuperAdminUser=${!!SuperAdminUser}`);

                    // 1. Find user in either table
                    let user = await User.findOne({
                        where: { email: email.toLowerCase() },
                        transaction
                    });
                    
                    console.log(`🔍 [LOGIN DEBUG] User.findOne result: ${user ? 'FOUND' : 'NOT FOUND'}`);

                    let isSuperAdmin = false;
                    if (!user && SuperAdminUser) {
                        user = await SuperAdminUser.findOne({
                            where: { email: email.toLowerCase() },
                            transaction
                        });
                        if (user) isSuperAdmin = true;
                        console.log(`🔍 [LOGIN DEBUG] SuperAdminUser.findOne result: ${user ? 'FOUND' : 'NOT FOUND'}`);
                    }
                    
                    if (!user) {
                        console.log(`🔍 [LOGIN DEBUG] No user found, throwing error`);
                        const error = new Error('Invalid email or password');
                        error.status = 401;
                        throw error;
                    }
                    
                    // 2. Validate state
                    console.log(`🔍 [LOGIN DEBUG] User found: ${user.email}, isActive: ${user.isActive}`);
                    
                    if (user.isActive === false) {
                        const error = new Error('Account is deactivated');
                        error.status = 403;
                        throw error;
                    }
                    
                    // 3. Verify password (handle both 'password' and 'passwordHash' fields)
                    const passwordField = isSuperAdmin ? user.passwordHash : user.password;
                    console.log(`🔍 [LOGIN DEBUG] Password field present: ${!!passwordField}, isSuperAdmin: ${isSuperAdmin}`);
                    
                    if (!passwordField) {
                        const error = new Error('User account configuration error');
                        error.status = 500;
                        throw error;
                    }

                    const isPasswordValid = await bcrypt.compare(password, passwordField);
                    console.log(`🔍 [LOGIN DEBUG] Password validation result: ${isPasswordValid}`);
                    
                    if (!isPasswordValid) {
                        const error = new Error('Invalid email or password');
                        error.status = 401;
                        throw error;
                    }
                    
                    // 4. Update last login (INSIDE TRANSACTION)
                    if (user.update) {
                        await user.update({ lastLogin: new Date() }, { transaction });
                    }
                    
                    // Return domain-compatible object
                    const rawUser = user.toJSON();
                    return {
                        ...rawUser,
                        role: isSuperAdmin ? 'SUPER_ADMIN' : rawUser.role,
                        panelType: isSuperAdmin ? 'ADMIN' : 'TENANT'
                    };
                }
            );

            console.log(`🔍 [LOGIN DEBUG] Executor result: ${JSON.stringify({ success: result.success, hasData: !!result.data })}`);

            if (!result.success) {
                const error = new Error(result.error || 'Login failed');
                error.status = 401;
                throw error;
            }

            return result.data;
            
        } catch (error) {
            console.error(`❌ [LOGIN DEBUG] Login error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Verify refresh token and return user data
     * PATTERN: Service → Repository → DB
     */
    async verifyRefreshToken(refreshToken) {
        try {
            const decoded = tokenService.verifyToken(refreshToken, true);
            if (!decoded || decoded.type !== 'refresh') return null;
            
            const userRepo = repositories.getUserRepository();
            
            // OPTIMIZED: Use fast path for auth read operations
            const result = await neonTransactionSafeExecutor.executeForAuth(
                async (context) => {
                    const transaction = context.transaction;
                    const user = await userRepo.findById(decoded.id, { 
                        transaction,
                        tenantId: CONTROL_PLANE 
                    });
                    
                    if (!user || !user.isActive) {
                        return null;
                    }
                    
                    // Check token version
                    if (decoded.tokenVersion !== (user.tokenVersion || 0)) {
                        return null;
                    }
                    
                    return user.toResponse();
                }
            );
            
            return result.success ? result.data : null;
            
        } catch (error) {
            return null;
        }
    }

    /**
     * Change user password
     * ENFORCES: Transaction-safe password & tokenVersion update
     * PATTERN: Service → Repository → DB
     */
    async changePassword(userId, currentPassword, newPassword) {
        try {
            const userRepo = repositories.getUserRepository();
            
            const result = await neonTransactionSafeExecutor.executeForAuth(
                async (context) => {
                    const transaction = context.transaction;
                    const { models } = context;
                    const User = models.User;

                    // 1. Find user (enforces transaction)
                    const user = await User.findOne({
                        where: { id: userId },
                        transaction
                    });
                    
                    if (!user) {
                        const error = new Error('User not found');
                        error.status = 404;
                        throw error;
                    }
                    
                    // 2. Verify current password
                    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
                    if (!isPasswordValid) {
                        const error = new Error('Current password is incorrect');
                        error.status = 401;
                        throw error;
                    }
                    
                    // 3. Hash new password
                    const hashedPassword = await bcrypt.hash(newPassword, 10);
                    
                    // 4. Update password and increment token version (INSIDE TRANSACTION)
                    const newVersion = (user.tokenVersion || 0) + 1;
                    await user.update({
                        password: hashedPassword,
                        tokenVersion: newVersion
                    }, { transaction });
                    
                    return {
                        success: true,
                        message: 'Password changed successfully. Please log in again.',
                        tokenVersion: newVersion
                    };
                }
            );

            if (!result.success) {
                const error = new Error(result.error || 'Password change failed');
                error.status = result.errorStatus || 500;
                throw error;
            }

            return result.data;
            
        } catch (error) {
            throw error;
        }
    }

    /**
     * Register a new user
     * ENFORCES: Transaction-safe user creation
     */
    async register(userData) {
        try {
            const { email, password, name, role = 'BusinessAdmin', businessId, outletId } = userData;
            
            const result = await neonTransactionSafeExecutor.executeWithTenant(
                TENANT_TYPES.CONTROL_PLANE,
                async (transaction, context) => {
                    const { models } = context;
                    const User = models.User;

                    // 1. Check if user already exists
                    const existingUser = await User.findOne({
                        where: { email: email.toLowerCase() },
                        transaction
                    });

                    if (existingUser) {
                        const error = new Error('Email already registered');
                        error.status = 409;
                        throw error;
                    }

                    // 2. Hash password
                    const hashedPassword = await bcrypt.hash(password, 10);
                    const userId = uuidv4();

                    // 3. Create user
                    const user = await User.create({
                        id: userId,
                        name,
                        email: email.toLowerCase(),
                        password: hashedPassword,
                        role,
                        businessId,
                        outletId,
                        isActive: true,
                        isVerified: true, // Default to true for now as per current onboarding flow
                        tokenVersion: 0,
                        panelType: 'TENANT'
                    }, { transaction });

                    return UserDomain.fromDatabase(user.toJSON()).toResponse();
                }
            );

            if (!result.success) {
                const error = new Error(result.error || 'Registration failed');
                error.status = result.errorStatus || 500;
                throw error;
            }

            return result.data;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Helper methods (Pure Logic)
     */
    generateAccessToken(user) {
        const payload = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            businessId: user.businessId,
            outletId: user.outletId,
            panelType: user.panelType || (user.role === 'SUPER_ADMIN' ? 'ADMIN' : 'TENANT'),
            tokenVersion: user.tokenVersion || 0
        };
        return tokenService.generateAccessToken(payload);
    }

    generateRefreshToken(user) {
        const payload = {
            id: user.id,
            email: user.email,
            role: user.role,
            tokenVersion: user.tokenVersion || 0
        };
        return tokenService.generateRefreshToken(payload);
    }

    async logout(req, res) {
        return await tokenService.logoutUser(req, res, false);
    }

    async invalidateAllTokens(req, res) {
        return await tokenService.logoutUser(req, res, true);
    }
}

module.exports = new AuthService();
