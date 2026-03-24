/**
 * BILLING CONTROLLER - Neon-Safe Transaction Pattern
 */

const createHttpError = require("http-errors");
const { safeQuery } = require("../utils/safeQuery");

/**
 * Get billing configuration
 */
exports.getConfig = async (req, res, next) => {
    try {
        const { businessId } = req;

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { BillingConfig } = models;
            
            let config = await BillingConfig.findOne({
                where: { businessId },
                transaction
            });

            if (!config) {
                // Create default config
                config = await BillingConfig.create({
                    businessId,
                    taxRate: 5,
                    serviceCharge: 0,
                    currency: 'INR',
                    roundToNearest: true,
                    printKOT: true,
                    printBill: true,
                    digitalReceipt: false
                }, { transaction });
            }

            return config;
        });

        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};

/**
 * Update billing configuration (full update)
 */
exports.updateConfig = async (req, res, next) => {
    try {
        const { businessId } = req;
        const configData = req.body;

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { BillingConfig } = models;
            
            let config = await BillingConfig.findOne({
                where: { businessId },
                transaction
            });

            if (config) {
                await config.update(configData, { transaction });
            } else {
                config = await BillingConfig.create({
                    businessId,
                    ...configData
                }, { transaction });
            }

            return config;
        });

        res.json({ success: true, data: result, message: "Billing configuration updated" });
    } catch (error) {
        next(error);
    }
};

/**
 * Patch billing configuration (partial update)
 */
exports.patchConfig = async (req, res, next) => {
    try {
        const { businessId } = req;
        const patchData = req.body;

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { BillingConfig } = models;
            
            let config = await BillingConfig.findOne({
                where: { businessId },
                transaction
            });

            if (config) {
                await config.update(patchData, { transaction });
            } else {
                config = await BillingConfig.create({
                    businessId,
                    taxRate: 5,
                    serviceCharge: 0,
                    currency: 'INR',
                    ...patchData
                }, { transaction });
            }

            return config;
        });

        res.json({ success: true, data: result, message: "Billing configuration patched" });
    } catch (error) {
        next(error);
    }
};
