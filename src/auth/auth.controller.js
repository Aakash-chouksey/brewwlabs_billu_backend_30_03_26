const authService = require('../../services/authService');
const config = require('../../config/config');
const { failedLoginTracker } = require('../../middlewares/authRateLimiting');
const { logAuthEvent } = require('../../security/auditLogger');

/**
 * Auth Controller
 * Only handles login/refresh and returns responses.
 */
const authController = {
    /**
     * Login - Email/Password
     */
    login: async (req, res) => {
        const startTime = Date.now();
        const { email, password, latitude, longitude } = req.body;
        const clientIP = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent');
        
        try {
            // Check if account is locked before proceeding
            const isLocked = await failedLoginTracker.isAccountLocked(email);
            if (isLocked) {
                logAuthEvent({
                    action: 'LOGIN_BLOCKED',
                    email,
                    ip: clientIP,
                    userAgent,
                    reason: 'Account locked due to failed attempts'
                });
                return res.status(423).json({ 
                    success: false, 
                    message: 'Account temporarily locked. Please try again later.' 
                });
            }

            const user = await authService.login(email, password, { latitude, longitude });

            // Clear failed attempts on successful login
            await failedLoginTracker.clearFailedAttempts(email);

            // Generate tokens
            const accessToken = await authService.generateAccessToken(user);
            const refreshToken = authService.generateRefreshToken(user);

            // Set secure cookies
            const cookieOptions = {
                httpOnly: true,
                secure: config.nodeEnv === 'production',
                sameSite: config.nodeEnv === 'production' ? 'strict' : 'lax',
                path: '/'
            };

            res.cookie('accessToken', accessToken, {
                ...cookieOptions,
                maxAge: 60 * 60 * 1000 // 1 hour
            });

            res.cookie('refreshToken', refreshToken, {
                ...cookieOptions,
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });

            // Log successful login (fire-and-forget, non-blocking)
            logAuthEvent({
                user_id: user.id,
                email: user.email,
                role: user.role,
                action: 'LOGIN_SUCCESS',
                ip: clientIP,
                userAgent,
                duration: Date.now() - startTime,
                business_id: user.businessId || user.business_id
            });

            res.status(200).json({
                success: true,
                message: "Login successful",
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    businessId: user.businessId || user.business_id,
                    outletId: user.outletId || user.outlet_id,
                    outlets: user.outletIds || user.outlet_ids || [],
                    lastLogin: user.lastLogin || user.last_login,
                    panelType: user.panelType || user.panel_type
                },
                accessToken,
                refreshToken
            });
        } catch (error) {
            console.error('❌ Login error:', error.message);
            
            // Log failed login attempt (fire-and-forget, non-blocking)
            logAuthEvent({
                action: 'LOGIN_FAILURE',
                email,
                ip: clientIP,
                userAgent,
                reason: error.message
            });

            const statusCode = error.status || 500;
            res.status(statusCode).json({
                success: false,
                message: error.message || "An error occurred during login"
            });
        }
    },

    /**
     * Refresh tokens
     */
    refreshTokens: async (req, res) => {
        try {
            const refreshToken = req.cookies?.refreshToken;
            if (!refreshToken) {
                return res.status(401).json({ success: false, message: 'Refresh token missing' });
            }

            const user = await authService.verifyRefreshToken(refreshToken);
            if (!user) {
                return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
            }

            const accessToken = await authService.generateAccessToken(user);

            res.cookie('accessToken', accessToken, {
                httpOnly: true,
                secure: config.nodeEnv === 'production',
                sameSite: config.nodeEnv === 'production' ? 'strict' : 'lax',
                maxAge: 60 * 60 * 1000 // 1 hour
            });

            res.status(200).json({ success: true, accessToken });
        } catch (error) {
            res.status(401).json({ success: false, message: 'Token refresh failed', error: error.message });
        }
    },

    /**
     * Logout
     */
    logout: async (req, res) => {
        try {
            const clientIP = req.ip || req.connection.remoteAddress;
            const userAgent = req.get('User-Agent');
            const user = req.auth || req.user;
            
            await authService.logout(req, res);
            
            if (user) {
                logAuthEvent({
                    user_id: user.id,
                    email: user.email,
                    role: user.role,
                    action: 'LOGOUT_SUCCESS',
                    ip: clientIP,
                    userAgent,
                    business_id: user.businessId || user.business_id
                });
            }
            
            res.status(200).json({ success: true, message: 'Logout successful' });
        } catch (error) {
            console.error('Logout error:', error);
            res.status(500).json({ success: false, message: 'Logout failed', error: error.message });
        }
    },

    /**
     * Current user info
     */
    me: async (req, res) => {
        try {
            const user = req.user || req.auth;
            if (!user) {
                return res.status(401).json({ success: false, message: 'User not authenticated' });
            }

            const userData = {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                businessId: user.businessId || user.business_id,
                outletId: user.outletId || user.outlet_id,
                panelType: user.panelType || user.panel_type || (user.role === 'SUPER_ADMIN' ? 'ADMIN' : 'TENANT')
            };

            res.status(200).json({ success: true, user: userData });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    // Placeholder methods for future implementation
    sendOtp: async (req, res) => {
        res.status(501).json({ success: false, message: 'OTP sending - Feature not implemented' });
    },

    verifyOtp: async (req, res) => {
        res.status(501).json({ success: false, message: 'OTP verification - Feature not implemented' });
    },

    /**
     * Firebase Google Authentication
     */
    firebaseGoogleAuth: async (req, res) => {
        res.status(501).json({ success: false, message: 'Firebase Google Auth - Feature not implemented' });
    },

    /**
     * Change password
     */
    changePassword: async (req, res) => {
        try {
            const { currentPassword, newPassword } = req.body;
            const user = req.user || req.auth;
            
            if (!user) {
                return res.status(401).json({ success: false, message: 'User not authenticated' });
            }
            
            if (!currentPassword || !newPassword) {
                return res.status(400).json({ success: false, message: 'Current password and new password are required' });
            }
            
            const result = await authService.changePassword(user.id, currentPassword, newPassword);
            
            res.status(200).json({
                success: true,
                message: result.message
            });
        } catch (error) {
            console.error('Change password error:', error);
            res.status(error.status || 500).json({
                success: false,
                message: error.message || 'Failed to change password'
            });
        }
    },

    /**
     * Invalidate all tokens (logout from all devices)
     */
    invalidateAllTokens: async (req, res) => {
        try {
            const result = await authService.invalidateAllTokens(req, res);
            
            res.status(200).json({
                success: true,
                message: result.message
            });
        } catch (error) {
            console.error('Invalidate tokens error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to invalidate tokens'
            });
        }
    },

    /**
     * Debug authentication endpoint
     */
    debugAuth: async (req, res) => {
        try {
            const debugInfo = {
                timestamp: new Date().toISOString(),
                headers: req.headers,
                cookies: req.cookies,
                body: req.body,
                user: req.user || req.auth,
                config: {
                    nodeEnv: config.nodeEnv,
                    hasGoogleClientId: !!config.googleClientId,
                    hasGoogleClientSecret: !!config.googleClientSecret
                }
            };

            res.status(200).json({ 
                success: true, 
                debug: debugInfo 
            });
        } catch (error) {
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    }
};

module.exports = authController;
