/**
 * TENANT PROFILE CONTROLLER - Neon-Safe Version
 * Standardized for transaction-scoped model access
 */

const createHttpError = require('http-errors');

const profileController = {
    /**
     * Get current user profile
     */
    getProfile: async (req, res, next) => {
        try {
            const user_id = req.user?.id || req.auth?.id;
            const business_id = req.business_id || req.businessId;

            if (!user_id) {
                throw createHttpError(401, 'User not authenticated');
            }

            const result = await req.readWithTenant(async (context) => {
                const { transactionModels: models } = context;
                const { User, Business, Outlet } = models;
                
                // 1. Fetch User
                const user = await User.findOne({
                    where: { id: user_id, businessId: business_id },
                    attributes: { exclude: ['password'] }
                });

                if (!user) {
                    throw createHttpError(404, 'User not found');
                }

                // 2. Fetch Business (Requested GOOD Pattern)
                const business = user.businessId
                    ? await Business.findByPk(user.businessId)
                    : null;

                // 3. Fetch current Outlet (Requested GOOD Pattern)
                const outlet = user.outletId
                    ? await Outlet.findByPk(user.outletId)
                    : null;

                // 4. Fetch ALL outlets for the user (Required for frontend selection)
                let outlets = [];
                let outletIdsRaw = user.outletIds || user.outlet_ids || [];
                let outletIds = [];

                // Robust parsing of JSONB/String array
                if (typeof outletIdsRaw === 'string') {
                    try {
                        outletIds = JSON.parse(outletIdsRaw);
                    } catch (e) {
                        outletIds = outletIdsRaw.split(',').filter(id => id.trim()).map(id => id.trim());
                    }
                } else if (Array.isArray(outletIdsRaw)) {
                    outletIds = outletIdsRaw;
                }

                // Handle case where user has single outletId but no outletIds array
                if (outletIds.length === 0 && user.outletId) {
                    outletIds = [user.outletId];
                }

                if (outletIds.length > 0) {
                    outlets = await Outlet.findAll({
                        where: { id: outletIds },
                        attributes: ['id', 'name', 'address', 'phone', 'isHeadOffice', 'isActive']
                    });
                }

                // Get plain user data
                const userPlain = user.toJSON ? user.toJSON() : user;
                
                // Get plain outlet data
                const outletsPlain = outlets.map(o => o.toJSON ? o.toJSON() : o);
                const outletPlain = outlet && outlet.toJSON ? outlet.toJSON() : outlet;
                const businessPlain = business && business.toJSON ? business.toJSON() : business;

                return { 
                    user: {
                        ...userPlain,
                        outlets: outletsPlain
                    }, 
                    business: businessPlain, 
                    outlet: outletPlain 
                };
            });

            const data = result.data || result;
            
            res.json({
                success: true,
                data: data,
                message: "Profile retrieved successfully"
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Update user profile
     */
    updateProfile: async (req, res, next) => {
        try {
            const user_id = req.user?.id || req.auth?.id;
            const business_id = req.business_id || req.businessId;
            const { name, phone, email } = req.body;
            
            if (!user_id) {
                throw createHttpError(401, 'User not authenticated');
            }

            const updated = await req.executeWithTenant(async (context) => {
                const { transaction, transactionModels: models } = context;
                const { User } = models;
                
                const user = await User.findOne({
                    where: { id: user_id, businessId: business_id },
                    transaction
                });

                if (!user) {
                    throw createHttpError(404, 'User not found');
                }

                const updateData = {};
                if (name) updateData.name = name;
                if (phone) updateData.phone = phone;
                if (email) updateData.email = email;

                await user.update(updateData, { transaction });
                return user;
            });

            const user = updated.data || updated;
            const { password: _, ...userWithoutPassword } = user.toJSON();

            res.json({
                success: true,
                data: userWithoutPassword,
                message: 'Profile updated successfully'
            });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = profileController;
