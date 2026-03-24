/**
 * SAFE QUERY HELPER
 * Wraps database operations with standardized error handling and fallbacks
 */
const safeQuery = async (queryFn, fallback) => {
    try {
        const result = await queryFn();

        if (result === null || result === undefined) {
            return fallback;
        }

        // Phase 4 Fix: If it's a number operation (sum/count), ensure it's a number
        if (typeof fallback === 'number') {
            return Number(result) || 0;
        }

        return result;
    } catch (err) {
        console.error('🚨 [SAFE QUERY ERROR]:', err.message);
        
        // Phase 2 Fix: Re-throw the error to expose the root cause
        // DO NOT return fallback on actual errors
        throw err;
    }
};

module.exports = { safeQuery };
