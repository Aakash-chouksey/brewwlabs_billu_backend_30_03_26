const { sequelize } = require("../config/unified_database");

const dbConnectionMiddleware = async (req, res, next) => {
    try {
        await sequelize.authenticate();
        next();
    } catch (error) {
        return res.status(503).json({
            success: false,
            message: "Database is not connected.",
            error: error.message
        });
    }
};

module.exports = { dbConnectionMiddleware };
