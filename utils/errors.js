/**
 * CUSTOM ERROR CLASSES
 * Standardized error handling for the multi-tenant POS application.
 */

class BadRequestError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BadRequestError';
    this.status = 400;
    this.statusCode = 400;
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.status = 404;
    this.statusCode = 404;
  }
}

module.exports = {
  BadRequestError,
  NotFoundError
};
