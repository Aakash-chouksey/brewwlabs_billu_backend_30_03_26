const createHttpError = require("http-errors");

// Authorization middleware that checks user roles
const authorize = (allowedRoles = []) => {
    return (req, res, next) => {
        try {
            // Check if user is authenticated and has role
            if (!req.auth || !req.auth.role) {
                return next(createHttpError(401, "Authentication required"));
            }

            // If no specific roles required, just check authentication
            if (allowedRoles.length === 0) {
                return next();
            }

            // Check if user's role is in allowed roles
            if (!allowedRoles.includes(req.auth.role)) {
                return next(createHttpError(403, "Insufficient permissions"));
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};

module.exports = { authorize };
