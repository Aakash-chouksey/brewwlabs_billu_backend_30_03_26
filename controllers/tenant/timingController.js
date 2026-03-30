/**
 * TIMING CONTROLLER - Neon-Safe Transaction Pattern
 */

const createHttpError = require("http-errors");

/**
 * Get all timings
 */
exports.getTimings = async (req, res, next) => {
    try {
        const { businessId } = req;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models, transaction } = context;
            const { Timing } = models;
            
            return await Timing.findAll({
                where: { businessId },
                order: [['dayOfWeek', 'ASC'], ['openTime', 'ASC']],
                transaction
            });
        });

        console.log('[TIMING CONTROLLER] getTimings result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const responseData = result.data || result;
        res.json({ 
            success: true, 
            message: "Timings retrieved successfully",
            data: responseData 
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Create timing
 */
exports.createTiming = async (req, res, next) => {
    try {
        const { businessId } = req;
        const { dayOfWeek, openTime, closeTime, isOpen, outletId } = req.body;

        if (dayOfWeek === undefined || !openTime || !closeTime) {
            throw createHttpError(400, "Day of week, open time, and close time are required");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Timing } = models;
            
            return await Timing.create({
                businessId,
                outletId,
                dayOfWeek,
                openTime,
                closeTime,
                isOpen: isOpen !== undefined ? isOpen : true
            }, { transaction });
        });

        console.log('[TIMING CONTROLLER] createTiming result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const responseData = result.data || result;
        res.status(201).json({ success: true, data: responseData, message: "Timing created" });
    } catch (error) {
        next(error);
    }
};

/**
 * Update timing
 */
exports.updateTiming = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { businessId } = req;
        const updateData = req.body;

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Timing } = models;
            
            const timing = await Timing.findOne({
                where: { id, businessId },
                transaction
            });
            if (!timing) throw createHttpError(404, "Timing not found");

            await timing.update(updateData, { transaction });
            return timing;
        });

        console.log('[TIMING CONTROLLER] updateTiming result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const responseData = result.data || result;
        res.json({ success: true, data: responseData, message: "Timing updated" });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete timing
 */
exports.deleteTiming = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { businessId } = req;

        await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Timing } = models;
            
            const timing = await Timing.findOne({
                where: { id, businessId },
                transaction
            });
            if (!timing) throw createHttpError(404, "Timing not found");

            await timing.destroy({ transaction });
        });

        res.json({ success: true, message: "Timing deleted" });
    } catch (error) {
        next(error);
    }
};
