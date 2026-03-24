const { v4: uuidv4 } = require('uuid');
const createHttpError = require('http-errors');

/**
 * Business Timing Controller - Neon-Safe Version
 * Standardized for transaction-scoped model access
 */
const businessTimingController = {
    /**
     * Get business timings
     */
    getTimings: async (req, res, next) => {
        try {
            const { businessId } = req;
            const outletId = req.outletId || req.headers['x-outlet-id'];

            const timings = await req.readWithTenant(async (context) => {
                const { transactionModels: models } = context;
                const { Timing } = models;

                const whereClause = { businessId };
                if (outletId) whereClause.outletId = outletId;

                return await Timing.findAll({
                    where: whereClause,
                    order: [['day', 'ASC']]
                });
            });

            res.json({
                success: true,
                data: timings,
                count: timings.length
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
            const { businessId } = req;
            const outletId = req.outletId || req.headers['x-outlet-id'];
            const { day, openTime, closeTime, isClosed } = req.body;

            if (day === undefined || !openTime || !closeTime) {
                throw createHttpError(400, 'Day, open time, and close time are required');
            }

            const result = await req.executeWithTenant(async (context) => {
                const { transaction, transactionModels: models } = context;
                const { Timing } = models;

                // Check if timing for this day already exists
                const existing = await Timing.findOne({
                    where: { businessId, outletId: outletId || null, day },
                    transaction
                });

                if (existing) {
                    await existing.update({
                        openTime,
                        closeTime,
                        isClosed: isClosed !== undefined ? isClosed : false
                    }, { transaction });

                    return {
                        message: 'Timing updated successfully',
                        data: existing,
                        created: false
                    };
                }

                // Create new timing
                const timing = await Timing.create({
                    id: uuidv4(),
                    businessId,
                    outletId: outletId || null,
                    day,
                    openTime,
                    closeTime,
                    isClosed: isClosed !== undefined ? isClosed : false
                }, { transaction });

                return {
                    message: 'Timing created successfully',
                    data: timing,
                    created: true
                };
            });

            res.status(result.created ? 201 : 200).json({
                success: true,
                ...result
            });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = businessTimingController;
