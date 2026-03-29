/**
 * TENANT STATUS CONTROLLER
 * Handles onboarding progress and system readiness checks
 */

const createHttpError = require('http-errors');

const tenantStatusController = {
    /**
     * Get current onboarding status for the user
     * GET /api/tenant/status
     */
    getStatus: async (req, res, next) => {
        try {
            const userId = req.user?.id || req.auth?.id;

            if (!userId) {
                throw createHttpError(401, 'User not authenticated');
            }

            // Use transaction-scoped access like profileController
            const result = await req.readWithTenant(async (context) => {
                const { transactionModels: models } = context;
                const { User } = models;

                if (!User) {
                    throw createHttpError(500, 'User model not available');
                }

                // Fetch user from tenant schema
                const user = await User.findOne({
                    where: { id: userId },
                    attributes: ['id', 'outletId', 'outletIds', 'status', 'businessId', 'role']
                });

                // Fetch full outlet details (plural) for the selection screen
                const { Outlet } = models;
                let outlets = [];
                const outletIds = user.outletIds || [];
                
                if (outletIds.length > 0) {
                    outlets = await Outlet.findAll({
                        where: { id: outletIds },
                        attributes: ['id', 'name', 'address', 'phone', 'isHeadOffice', 'isActive']
                    });
                }

                // SIMPLIFIED: Always return DASHBOARD for onboarded users
                // System now auto-creates outlet during onboarding
                const hasOutlet = !!user.outletId;
                const isApproved = user.status === 'ACTIVE';
                
                // ENFORCE: ACTIVE user must have outlet_id
                if (user.status === 'ACTIVE' && !user.outletId) {
                    console.error(`❌ VALIDATION ERROR: User ${userId} is ACTIVE but has no outlet_id`);
                    // Auto-fix: Set to PENDING if missing outlet
                    await user.update({ status: 'PENDING' });
                }

                return {
                    hasOutlet,
                    isApproved,
                    status: user.status,
                    businessId: user.businessId,
                    outletId: user.outletId,
                    outlets: outlets.map(o => o.toJSON ? o.toJSON() : o),
                    role: user.role,
                    // SIMPLIFIED: Always direct to dashboard if user has outlet
                    screen: hasOutlet && isApproved ? 'DASHBOARD' : 'ONBOARDING'
                };
            });

            const data = result.data || result;

            return res.json({
                success: true,
                data,
                message: "Tenant status retrieved successfully"
            });
        } catch (error) {
            console.error('❌ Status API Error:', error.message);
            next(error);
        }
    }
};

module.exports = tenantStatusController;
