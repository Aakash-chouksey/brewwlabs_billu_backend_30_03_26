/**
 * Outlet Controller - Neon-Safe Version
 * Standardized for transaction-scoped model access
 */

const { v4: uuidv4 } = require('uuid');

const outletController = {
    /**
     * Get all outlets for business
     */
    getOutlets: async (req, res, next) => {
        try {
            const { businessId } = req;

            const result = await req.readWithTenant(async (context) => {
                const { transactionModels: models } = context;
                const { Outlet } = models;

                const outlets = await Outlet.findAll({
                    where: { businessId },
                    order: [['is_head_office', 'DESC'], ['created_at', 'DESC']]
                });
                
                return outlets || [];
            });

            // Handle safe response - ensure data is always an array
            const outlets = result.data || result || [];
            
            res.json({
                success: true,
                data: outlets,
                count: outlets.length || 0
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
            const { businessId } = req;
            const { name, address, phone, email, gstNumber } = req.body;

            const outlet = await req.executeWithTenant(async (context) => {
                const { transaction, transactionModels: models } = context;
                const { Outlet } = models;

                return await Outlet.create({
                    id: uuidv4(),
                    businessId,
                    name,
                    address,
                    phone,
                    email,
                    gstNumber,
                    isActive: true,
                    isHeadOffice: false
                }, { transaction });
            });

            res.status(201).json({
                success: true,
                message: 'Outlet created successfully',
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
            const { businessId } = req;
            const { name, address, phone, email, gstNumber, isActive } = req.body;

            const updated = await req.executeWithTenant(async (context) => {
                const { transaction, transactionModels: models } = context;
                const { Outlet } = models;

                const outlet = await Outlet.findOne({
                    where: { id, businessId },
                    transaction
                });

                if (!outlet) {
                    throw new Error('Outlet not found');
                }

                const updateData = {};
                if (name !== undefined) updateData.name = name;
                if (address !== undefined) updateData.address = address;
                if (phone !== undefined) updateData.phone = phone;
                if (email !== undefined) updateData.email = email;
                if (gstNumber !== undefined) updateData.gstNumber = gstNumber;
                if (isActive !== undefined) updateData.isActive = isActive;

                return await outlet.update(updateData, { transaction });
            });

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
