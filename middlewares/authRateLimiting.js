const createHttpError = require('http-errors');
const { createRateLimitMiddleware } = require('../utils/inMemoryRateLimiter');

/**
 * Enhanced Rate Limiting for Authentication (NO REDIS)
 * Provides protection using in-memory storage
 */

// General API rate limiting
const generalLimiter = createRateLimitMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per window
  message: 'Too many requests from this IP, please try again later.',
  keyGenerator: (req) => `general:${req.ip}`
});

// Strict authentication rate limiting
const authLimiter = createRateLimitMiddleware({
  windowMs: 15 * 60 * 1000,
  max: 50, // 50 auth attempts per window
  message: 'Too many authentication attempts, please try again later.',
  keyGenerator: (req) => `auth:${req.ip}:${req.body.email || 'unknown'}`,
  skipSuccessfulRequests: true
});

// Very strict login rate limiting
const loginLimiter = createRateLimitMiddleware({
  windowMs: 15 * 60 * 1000,
  max: 10, // 10 login attempts per window
  message: 'Too many login attempts, please try again later.',
  keyGenerator: (req) => `login:${req.ip}:${req.body.email || 'unknown'}`,
  skipSuccessfulRequests: true
});

// OTP rate limiting
const otpLimiter = createRateLimitMiddleware({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 OTP requests per window
  message: 'Too many OTP requests, please try again later.',
  keyGenerator: (req) => `otp:${req.ip}:${req.body.email || 'unknown'}`,
  skipSuccessfulRequests: true
});

// Password reset rate limiting
const passwordResetLimiter = createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  message: 'Too many password reset attempts, please try again later.',
  keyGenerator: (req) => `pwdreset:${req.ip}:${req.body.email || 'unknown'}`
});

// Account creation rate limiting
const accountCreationLimiter = createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 accounts per hour per IP
  message: 'Too many account creation attempts, please try again later.',
  keyGenerator: (req) => `signup:${req.ip}`
});

// Failed login tracking with progressive delays
class FailedLoginTracker {
  constructor() {
    this.failedAttempts = new Map();
    this.lockedAccounts = new Map();
    this.MAX_ATTEMPTS = 5;
    this.LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes
  }

  async recordFailedAttempt(email, ip) {
    const key = `${email}:${ip}`;
    const attempts = this.failedAttempts.get(key) || [];
    const now = Date.now();
    
    attempts.push(now);
    
    const recentAttempts = attempts.filter(t => now - t < 3600000);
    this.failedAttempts.set(key, recentAttempts);
    
    if (recentAttempts.length >= this.MAX_ATTEMPTS) {
      await this.lockAccount(email, ip);
      return true;
    }
    
    return false;
  }

  async lockAccount(email, ip) {
    const key = `${email}:${ip}`;
    const unlockAt = Date.now() + this.LOCKOUT_DURATION;
    this.lockedAccounts.set(key, unlockAt);
  }

  async isAccountLocked(email, ip) {
    const key = `${email}:${ip}`;
    const unlockAt = this.lockedAccounts.get(key);
    
    if (!unlockAt) return false;
    
    if (Date.now() > unlockAt) {
      this.lockedAccounts.delete(key);
      this.failedAttempts.delete(key);
      return false;
    }
    
    return true;
  }

  async clearFailedAttempts(email, ip) {
    const key = `${email}:${ip}`;
    this.failedAttempts.delete(key);
    this.lockedAccounts.delete(key);
  }

  async getRemainingAttempts(email, ip) {
    const key = `${email}:${ip}`;
    const attempts = this.failedAttempts.get(key) || [];
    const now = Date.now();
    const recentAttempts = attempts.filter(t => now - t < 3600000);
    return Math.max(0, this.MAX_ATTEMPTS - recentAttempts.length);
  }

  cleanup() {
    const now = Date.now();
    for (const [key, unlockAt] of this.lockedAccounts.entries()) {
      if (now > unlockAt) {
        this.lockedAccounts.delete(key);
        this.failedAttempts.delete(key);
      }
    }
  }
}

const failedLoginTracker = new FailedLoginTracker();

setInterval(() => failedLoginTracker.cleanup(), 600000);

const checkAccountLockout = async (req, res, next) => {
  try {
    const { email } = req.body;
    const ip = req.ip;
    
    if (!email) return next();
    
    const isLocked = await failedLoginTracker.isAccountLocked(email, ip);
    
    if (isLocked) {
      return res.status(423).json({
        success: false,
        error: 'Account temporarily locked',
        message: 'Too many failed login attempts. Please try again in 30 minutes.'
      });
    }
    
    next();
  } catch (error) {
    console.error('Account lockout check error:', error);
    next();
  }
};

module.exports = {
  generalLimiter,
  authLimiter,
  loginLimiter,
  otpLimiter,
  passwordResetLimiter,
  accountCreationLimiter,
  failedLoginTracker,
  checkAccountLockout
};
