const jwt = require('jsonwebtoken');
const config = require('../../config/config');
const tokenBlacklist = require('../cache/tokenBlacklist');
const { logAuthEvent } = require('../../security/auditLogger');

/**
 * Token Management Service
 * Handles secure token creation, validation, and revocation
 */
class TokenService {
    constructor() {
        this.issuer = 'brewwlabs-pos';
        this.audience = 'brewwlabs-pos-users';
    }

    /**
     * Generate access token with strict claims
     */
    generateAccessToken(payload) {
        const now = Math.floor(Date.now() / 1000);
        const tokenPayload = {
            ...payload,
            iat: now,
            exp: now + (24 * 60 * 60), // 24 hours
            iss: this.issuer,
            aud: this.audience,
            jti: this.generateJTI(), // Unique token ID
            tokenVersion: payload.tokenVersion || 0
        };

        return jwt.sign(tokenPayload, config.accessTokenSecret, {
            algorithm: 'HS256'
        });
    }

    /**
     * Generate refresh token
     */
    generateRefreshToken(payload) {
        const now = Math.floor(Date.now() / 1000);
        const tokenPayload = {
            ...payload,
            iat: now,
            exp: now + (7 * 24 * 60 * 60), // 7 days
            iss: this.issuer,
            aud: this.audience,
            jti: this.generateJTI(),
            type: 'refresh'
        };

        return jwt.sign(tokenPayload, config.refreshTokenSecret || config.accessTokenSecret, {
            algorithm: 'HS256'
        });
    }

    /**
     * Generate unique JTI (JWT ID)
     */
    generateJTI() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${process.pid}`;
    }

    /**
     * Verify token with strict validation
     */
    verifyToken(token, isRefreshToken = false) {
        try {
            const secret = isRefreshToken && config.refreshTokenSecret ? 
                config.refreshTokenSecret : config.accessTokenSecret;
                
            return jwt.verify(token, secret, {
                issuer: this.issuer,
                audience: this.audience,
                clockTolerance: 30
            });
        } catch (error) {
            throw error;
        }
    }

    /**
     * Logout user - invalidate all their tokens
     */
    async logoutUser(req, res, logoutAllDevices = false) {
        try {
            const auth = req.auth;
            const token = req.cookies?.accessToken || 
                        (req.headers.authorization?.startsWith('Bearer ') ? 
                         req.headers.authorization.split(' ')[1] : null);

            if (!auth || !token) {
                return { success: false, message: 'No valid session found' };
            }

            const userId = auth.id || auth.userId;
            const userRole = auth.role;

            // Log logout event
            await logAuthEvent({
                userId,
                email: auth.email,
                role: userRole,
                action: 'LOGOUT',
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                path: req.path,
                logoutAllDevices
            });

            if (logoutAllDevices) {
                // Invalidate all user tokens by incrementing token version
                const newVersion = await tokenBlacklist.invalidateUserTokens(userId, userRole);
                
                // Blacklist current token immediately
                await tokenBlacklist.blacklistToken(token, auth.jti, userId);

                // Clear cookie
                res.clearCookie("accessToken");

                return {
                    success: true,
                    message: 'Logged out from all devices',
                    newTokenVersion: newVersion
                };
            } else {
                // Blacklist only current token
                const blacklisted = await tokenBlacklist.blacklistToken(token, auth.jti, userId);
                
                // Clear cookie
                res.clearCookie("accessToken");

                return {
                    success: true,
                    message: 'Logged out successfully',
                    blacklisted
                };
            }

        } catch (error) {
            console.error('Logout error:', error);
            return { success: false, message: 'Logout failed' };
        }
    }

    /**
     * Check if token is expired
     */
    isTokenExpired(token) {
        try {
            const decoded = jwt.decode(token);
            if (!decoded || !decoded.exp) {
                return true;
            }
            return Date.now() >= decoded.exp * 1000;
        } catch (error) {
            return true;
        }
    }
}

// Export singleton instance
module.exports = new TokenService();
