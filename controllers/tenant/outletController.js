/**
 * OUTLET CONTROLLER - Neon-Safe Version
 * Standardized for transaction-scoped model access and multitenant safety
 */

const { v4: uuidv4 } = require('uuid');
const { User } = require('../../control_plane_models');

const outletController = {
    /**
     * Get all outlets for business
     */
    getOutlets: async (req, res, next) => {
        try {
            const business_id = req.business_id || req.businessId;

            const cacheKey = 'outlets_list';
            const result = await req.readWithCache(business_id, cacheKey, async (context) => {
                const { transactionModels: models } = context;
                const { Outlet } = models;

                return await Outlet.findAll({
                    where: { businessId: business_id },
                    order: [['is_head_office', 'DESC'], ['created_at', 'DESC']]
                });
            }, { ttl: 3600000 }); // 1 hour cache, as outlets change very rarely

            const outlets = result.data || result || [];
            
            res.json({
                success: true,
                data: outlets,
                count: outlets.length,
                message: "Outlets retrieved successfully"
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Create new outlet
     */
    createOutlet: async (req, res, next) => {
        try {
            const business_id = req.business_id || req.businessId;
            const { name, address, phone, email, gstNumber } = req.body;

            const result = await req.executeWithTenant(async (context) => {
                const { transaction, transactionModels: models } = context;
                const { Outlet } = models;

                const outlet = await Outlet.create({
                    id: uuidv4(),
                    businessId: business_id,
                    name,
                    address,
                    phone,
                    email,
                    gstNumber,
                    isActive: true,
                    isHeadOffice: false
                }, { transaction });

                // CRITICAL: Link this outlet to the user in the control plane (public schema)
                // This ensures /api/tenant/status now returns hasOutlet: true
                const userId = req.user?.id || req.auth?.id;
                if (userId) {
                    await User.update(
                        { outletId: outlet.id },
                        { where: { id: userId } }
                    );
                    console.log(`🔗 Linked user ${userId} to new outlet ${outlet.id}`);
                }

                return outlet;
            });

            const outlet = result.data || result;

            res.status(201).json({
                success: true,
                message: 'Outlet created successfully and linked to your profile',
                data: outlet
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Update outlet
     */
    updateOutlet: async (req, res, next) => {
        try {
            const { id } = req.params;
            const business_id = req.business_id || req.businessId;
            const updateData = req.body;

            const result = await req.executeWithTenant(async (context) => {
                const { transaction, transactionModels: models } = context;
                const { Outlet } = models;

                const outlet = await Outlet.findOne({
                    where: { id, businessId: business_id },
                    transaction
                });

                if (!outlet) {
                    throw new Error('Outlet not found');
                }

                // Remove restricted fields
                delete updateData.id;
                delete updateData.businessId;

                return await outlet.update(updateData, { transaction });
            });

            const updated = result.data || result;

            res.json({
                success: true,
                message: 'Outlet updated successfully',
                data: updated
            });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = outletController;
