/**
 * Timing Controller - Neon-Safe Version
 * Standardized for transaction-scoped model access
 */

const { v4: uuidv4 } = require('uuid');

const timingController = {
    /**
     * Get all operation timings
     */
    getTimings: async (req, res, next) => {
        try {
            const { businessId } = req;

            const timings = await req.readWithTenant(async (context) => {
                const { transactionModels: models } = context;
                const { OperationTiming } = models;

                return await OperationTiming.findAll({
                    where: { businessId },
                    order: [['day', 'ASC']]
                });
            });

            res.json({
                success: true,
                data: timings
            });

        } catch (error) {
            next(error);
        }
    },

    /**
     * Create operation timing
     */
    createTiming: async (req, res, next) => {
        try {
            const { businessId } = req;
            const { day, openTime, closeTime, isOpen } = req.body;

            const timing = await req.executeWithTenant(async (context) => {
                const { transaction, transactionModels: models } = context;
                const { OperationTiming } = models;

                // Check if timing already exists for this day
                const existing = await OperationTiming.findOne({
                    where: { businessId, day },
                    transaction
                });

                if (existing) {
                    throw new Error(`Timing already exists for ${day}. Use PUT to update.`);
                }

                return await OperationTiming.create({
                    id: uuidv4(),
                    businessId,
                    day,
                    openTime,
                    closeTime,
                    isOpen: isOpen !== undefined ? isOpen : true
                }, { transaction });
            });

            res.status(201).json({
                success: true,
                message: 'Operation timing created',
                data: timing
            });

        } catch (error) {
            next(error);
        }
    },

    /**
     * Update operation timing
     */
    updateTiming: async (req, res, next) => {
        try {
            const { id } = req.params;
            const { businessId } = req;
            const { day, openTime, closeTime, isOpen } = req.body;

            const updated = await req.executeWithTenant(async (context) => {
                const { transaction, transactionModels: models } = context;
                const { OperationTiming } = models;

                const timing = await OperationTiming.findOne({
                    where: { id, businessId },
                    transaction
                });

                if (!timing) {
                    throw new Error('Timing not found');
                }

                const updateData = {};
                if (day !== undefined) updateData.day = day;
                if (openTime !== undefined) updateData.openTime = openTime;
                if (closeTime !== undefined) updateData.closeTime = closeTime;
                if (isOpen !== undefined) updateData.isOpen = isOpen;

                return await timing.update(updateData, { transaction });
            });

            res.json({
                success: true,
                message: 'Operation timing updated',
                data: updated
            });

        } catch (error) {
            next(error);
        }
    },

    /**
     * Delete operation timing
     */
    deleteTiming: async (req, res, next) => {
        try {
            const { id } = req.params;
            const { businessId } = req;

            await req.executeWithTenant(async (context) => {
                const { transaction, transactionModels: models } = context;
                const { OperationTiming } = models;

                const timing = await OperationTiming.findOne({
                    where: { id, businessId },
                    transaction
                });

                if (!timing) {
                    throw new Error('Timing not found');
                }

                await timing.destroy({ transaction });
            });

            res.json({
                success: true,
                message: 'Operation timing deleted'
            });

        } catch (error) {
            next(error);
        }
    }
};

module.exports = timingController;
