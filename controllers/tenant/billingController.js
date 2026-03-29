/**
 * BILLING CONTROLLER - Neon-Safe Transaction Pattern
 */

const createHttpError = require("http-errors");

/**
 * Get billing configuration
 */
exports.getConfig = async (req, res, next) => {
    try {
        const business_id = req.business_id || req.businessId;

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { BillingConfig } = models;
            
            let config = await BillingConfig.findOne({
                where: { businessId: business_id },
                transaction
            });

            if (!config) {
                // Create default config
                config = await BillingConfig.create({
                    businessId: business_id,
                    taxRate: 0.05,
                    serviceChargeRate: 0,
                    taxInclusive: false,
                    footerText: 'Thank you for your business!',
                    themeColor: '#000000',
                    paperSize: 'Thermal80mm',
                    showLogo: true,
                    isActive: true
                }, { transaction });
            }

            return config;
        });

        const responseData = result.data || result;
        res.json({ 
            success: true, 
            data: responseData,
            message: "Billing configuration retrieved successfully"
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update billing configuration (full update)
 */
exports.updateConfig = async (req, res, next) => {
    try {
        const business_id = req.business_id || req.businessId;
        const configData = req.body;

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { BillingConfig } = models;
            
            let config = await BillingConfig.findOne({
                where: { businessId: business_id },
                transaction
            });

            if (config) {
                await config.update(configData, { transaction });
            } else {
                config = await BillingConfig.create({
                    businessId: business_id,
                    ...configData
                }, { transaction });
            }

            return config;
        });

        const responseData = result.data || result;
        res.json({ 
            success: true, 
            data: responseData, 
            message: "Billing configuration updated successfully" 
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Patch billing configuration (partial update)
 */
exports.patchConfig = async (req, res, next) => {
    try {
        const business_id = req.business_id || req.businessId;
        const patchData = req.body;

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { BillingConfig } = models;
            
            let config = await BillingConfig.findOne({
                where: { businessId: business_id },
                transaction
            });

            if (config) {
                await config.update(patchData, { transaction });
            } else {
                config = await BillingConfig.create({
                    businessId: business_id,
                    taxRate: 0.05,
                    paperSize: 'Thermal80mm',
                    ...patchData
                }, { transaction });
            }

            return config;
        });

        const responseData = result.data || result;
        res.json({ 
            success: true, 
            data: responseData, 
            message: "Billing configuration patched successfully" 
        });
    } catch (error) {
        next(error);
    }
};
