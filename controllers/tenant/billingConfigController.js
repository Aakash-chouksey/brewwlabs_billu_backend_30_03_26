/**
 * Billing Config Controller - Neon-Safe Version
 * Standardized for transaction-scoped model access
 */

const { v4: uuidv4 } = require('uuid');

const billingConfigController = {
    /**
     * Get billing config
     */
    getConfig: async (req, res, next) => {
        try {
            const { businessId } = req;

            const result = await req.executeWithTenant(async (context) => {
                const { transaction, transactionModels: models } = context;
                const { BillingConfig, Business } = models;

                let config = await BillingConfig.findOne({
                    where: { businessId },
                    transaction
                });

                // Create default config if not exists
                if (!config) {
                    const business = await Business.findOne({
                        where: { id: businessId },
                        transaction
                    });

                    config = await BillingConfig.create({
                        id: uuidv4(),
                        businessId,
                        businessName: business?.name || '',
                        address: business?.address || '',
                        phone: business?.phone || '',
                        email: business?.email || '',
                        gstNumber: business?.gstNumber || '',
                        taxPercent: 5,
                        receiptFooter: 'Thank you for your business!',
                        isActive: true
                    }, { transaction });
                }

                return config;
            });

            res.json({
                success: true,
                data: result
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
            const { businessId } = req;
            const { businessName, address, phone, email, gstNumber, taxPercent, receiptFooter } = req.body;

            const result = await req.executeWithTenant(async (context) => {
                const { transaction, transactionModels: models } = context;
                const { BillingConfig } = models;

                let config = await BillingConfig.findOne({
                    where: { businessId },
                    transaction
                });

                if (!config) {
                    // Create new config
                    return await BillingConfig.create({
                        id: uuidv4(),
                        businessId,
                        businessName,
                        address,
                        phone,
                        email,
                        gstNumber,
                        taxPercent,
                        receiptFooter,
                        isActive: true
                    }, { transaction });
                }

                // Update existing
                const updateData = {};
                if (businessName !== undefined) updateData.businessName = businessName;
                if (address !== undefined) updateData.address = address;
                if (phone !== undefined) updateData.phone = phone;
                if (email !== undefined) updateData.email = email;
                if (gstNumber !== undefined) updateData.gstNumber = gstNumber;
                if (taxPercent !== undefined) updateData.taxPercent = taxPercent;
                if (receiptFooter !== undefined) updateData.receiptFooter = receiptFooter;

                await config.update(updateData, { transaction });
                return config;
            });

            res.json({
                success: true,
                message: 'Billing config updated',
                data: result
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
