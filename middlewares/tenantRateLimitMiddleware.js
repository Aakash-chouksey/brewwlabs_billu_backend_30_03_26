// Temporarily disabled rate limiting for testing
const tenantRateLimit = (type = 'api') => {
    return (req, res, next) => {
        console.log(`⚠️ Rate limiting disabled for testing (${type})`);
        next();
    };
};

const createTenantRateLimiter = () => {
    return (req, res, next) => {
        console.log(`⚠️ Rate limiting disabled for testing`);
        next();
    };
};

const rateLimiters = {
    api: (req, res, next) => { console.log('⚠️ API rate limit disabled'); next(); },
    strict: (req, res, next) => { console.log('⚠️ Strict rate limit disabled'); next(); },
    auth: (req, res, next) => { console.log('⚠️ Auth rate limit disabled'); next(); },
    orders: (req, res, next) => { console.log('⚠️ Orders rate limit disabled'); next(); },
    uploads: (req, res, next) => { console.log('⚠️ Uploads rate limit disabled'); next(); }
};

module.exports = {
    createTenantRateLimiter,
    tenantRateLimit,
    rateLimiters
};
