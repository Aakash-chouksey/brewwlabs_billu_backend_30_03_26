/**
 * Security Guards for Data-First Architecture
 * Enforces strict transaction and tenant safety rules
 */

/**
 * Assert that a transaction object is present and active
 * @param {object} transaction - Sequelize transaction object
 * @throws {Error} if transaction is missing or invalid
 */
const assertTransaction = (transaction) => {
    if (!transaction) {
        throw new Error('🚨 BLOCKED: DB operation without transaction is forbidden');
    }
    
    // Check if transaction is already finished
    if (transaction.finished) {
        throw new Error('🚨 BLOCKED: Transaction has already been committed or rolled back');
    }
};

/**
 * Assert that a tenant identifier is present
 * @param {string} tenantId - Tenant identifier (UUID or 'control_plane')
 * @throws {Error} if tenantId is missing
 */
const assertTenant = (tenantId) => {
    if (!tenantId) {
        throw new Error('❌ NEON SAFETY VIOLATION: Tenant identifier is required for this operation.');
    }
};

module.exports = {
    assertTransaction,
    assertTenant
};
