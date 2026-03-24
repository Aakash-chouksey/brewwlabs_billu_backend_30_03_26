/**
 * SAFE UTILS INDEX
 * 
 * Central export point for all fail-safe utilities.
 * Use these for consistent error handling across the application.
 */

// Safe data handling
const safeDb = require('./safeDb');

// Safe database queries
const { safeQuery } = require('./safeQuery');

// API Response helpers
const apiResponse = require('./apiResponse');

// Response helpers (legacy but maintained)
const responseHelper = require('./responseHelper');

// Fail-safe wrappers
const failSafe = require('./failSafe');

// Logging utilities
const logging = require('./logging');

module.exports = {
  // Safe data functions
  ...safeDb,
  
  // Database query wrapper
  safeQuery,
  
  // Response builders
  apiResponse,
  response: apiResponse,
  responseHelper,
  
  // Fail-safe wrappers
  ...failSafe,
  
  // Logging
  ...logging,
  
  // Legacy exports for compatibility
  createResponse: responseHelper.createResponse,
  createErrorResponse: responseHelper.createErrorResponse,
  sendSuccess: responseHelper.sendSuccess,
  sendError: responseHelper.sendError
};
