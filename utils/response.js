/**
 * STANDARDIZED API RESPONSE LAYER (Phase 4)
 * Ensures consistent JSON output across all controllers.
 */

const successResponse = (res, data, message = 'Success', code = 200) => {
    return res.status(code).json({
        success: true,
        message,
        data: data || null
    });
};

const errorResponse = (res, message = 'Error', code = 500, errors = null) => {
    return res.status(code).json({
        success: false,
        message,
        errors: errors || null,
        data: null
    });
};

module.exports = {
    successResponse,
    errorResponse
};
