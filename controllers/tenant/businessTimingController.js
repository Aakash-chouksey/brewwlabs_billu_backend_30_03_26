const { v4: uuidv4 } = require('uuid');
const createHttpError = require('http-errors');

/**
 * BUSINESS TIMING CONTROLLER - Neon-Safe Version
 * Standardized for transaction-scoped model access
 */
const businessTimingController = {
    /**
     * Get business timings
     */
    getTimings: async (req, res, next) => {
        try {
            const business_id = req.business_id || req.businessId;
            const outlet_id = req.outlet_id || req.outletId;

            const result = await req.readWithTenant(async (context) => {
                const { transactionModels: models } = context;
                const { Timing } = models;

                const whereClause = { businessId: business_id };
                if (outlet_id) whereClause.outletId = outlet_id;

                return await Timing.findAll({
                    where: whereClause,
                    order: [['day', 'ASC']]
                });
            });

            const timings = result.data || result || [];

            res.json({
                success: true,
                data: timings,
                count: timings.length,
                message: "Business timings retrieved successfully"
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Create/Update business timing
     */
    createTiming: async (req, res, next) => {
        try {
            const business_id = req.business_id || req.businessId;
            const outlet_id = req.outlet_id || req.outletId;
            const { day, openTime, closeTime, isClosed } = req.body;

            if (day === undefined || !openTime || !closeTime) {
                throw createHttpError(400, 'Day, open time, and close time are required');
            }

            const result = await req.executeWithTenant(async (context) => {
                const { transaction, transactionModels: models } = context;
                const { Timing } = models;

                // Check if timing for this day already exists
                const existing = await Timing.findOne({
                    where: { businessId: business_id, outletId: outlet_id || null, day },
                    transaction
                });

                if (existing) {
                    await existing.update({
                        openTime,
                        closeTime,
                        isClosed: isClosed !== undefined ? isClosed : false
                    }, { transaction });

                    return existing;
                }

                // Create new timing
                return await Timing.create({
                    id: uuidv4(),
                    businessId: business_id,
                    outletId: outlet_id || null,
                    day,
                    openTime,
                    closeTime,
                    isClosed: isClosed !== undefined ? isClosed : false
                }, { transaction });
            });

            const data = result.data || result;

            res.status(200).json({
                success: true,
                data: data,
                message: 'Business timing updated successfully'
            });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = businessTimingController;
