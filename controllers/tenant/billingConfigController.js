/**
 * BILLING CONFIG CONTROLLER - Neon-Safe Version
 * Standardized for transaction-scoped model access
 */

const { v4: uuidv4 } = require('uuid');

const billingConfigController = {
    /**
     * Get billing config
     */
    getConfig: async (req, res, next) => {
        try {
            const business_id = req.business_id || req.businessId;

            const result = await req.executeWithTenant(async (context) => {
                const { transaction, transactionModels: models } = context;
                const { BillingConfig, Business } = models;

                let config = await BillingConfig.findOne({
                    where: { businessId: business_id },
                    transaction
                });

                // Create default config if not exists
                if (!config) {
                    const business = await Business.findOne({
                        where: { id: business_id },
                        transaction
                    });

                    config = await BillingConfig.create({
                        id: uuidv4(),
                        businessId: business_id,
                        businessName: business?.name || '',
                        businessAddress: business?.address || '',
                        businessPhone: business?.phone || '',
                        businessEmail: business?.email || '',
                        gstNumber: business?.gstNumber || '',
                        taxRate: 0.05,
                        footerText: 'Thank you for your business!',
                        isActive: true
                    }, { transaction });
                }

                return config;
            });

            const data = result.data || result;
            
            res.json({
                success: true,
                data: data,
                message: "Billing configuration retrieved successfully"
            });

        } catch (error) {
            next(error);
        }
    },

    /**
     * Update billing config (full update)
     */
    updateConfig: async (req, res, next) => {
        try {
            const business_id = req.business_id || req.businessId;
            const updateData = req.body;

            const result = await req.executeWithTenant(async (context) => {
                const { transaction, transactionModels: models } = context;
                const { BillingConfig } = models;

                let config = await BillingConfig.findOne({
                    where: { businessId: business_id },
                    transaction
                });

                if (!config) {
                    // Create new config
                    return await BillingConfig.create({
                        id: uuidv4(),
                        businessId: business_id,
                        ...updateData,
                        isActive: true
                    }, { transaction });
                }

                // Update existing
                await config.update(updateData, { transaction });
                return config;
            });

            const data = result.data || result;

            res.json({
                success: true,
                data: data,
                message: 'Billing configuration updated successfully'
            });

        } catch (error) {
            next(error);
        }
    },

    /**
     * Patch billing config (partial update)
     */
    patchConfig: async (req, res, next) => {
        return billingConfigController.updateConfig(req, res, next);
    }
};

module.exports = billingConfigController;
