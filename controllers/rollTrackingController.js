/**
 * ROLL TRACKING CONTROLLER - Neon-Safe Transaction Pattern
 */

const createHttpError = require("http-errors");

/**
 * Add roll
 */
exports.addRoll = async (req, res, next) => {
    try {
        const { businessId } = req;
        const { outletId, rollType, initialLength, batchNumber, supplierId } = req.body;

        if (!outletId || !rollType || !initialLength) {
            throw createHttpError(400, "Outlet ID, roll type, and initial length are required");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Roll, Outlet } = models;
            
            // Verify outlet exists
            const outlet = await Outlet.findOne({
                where: { id: outletId, businessId },
                transaction
            });
            if (!outlet) throw createHttpError(404, "Outlet not found");

            return await Roll.create({
                businessId,
                outletId,
                rollType,
                initialLength,
                remainingLength: initialLength,
                batchNumber,
                supplierId,
                status: 'ACTIVE',
                addedBy: req.auth?.id
            }, { transaction });
        });

        res.status(201).json({ success: true, data: result, message: "Roll added" });
    } catch (error) {
        next(error);
    }
};

/**
 * Get roll stats for outlet
 */
exports.getRollStats = async (req, res, next) => {
    try {
        const { outletId } = req.params;
        const { businessId } = req;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models, transaction } = context;
            const { Roll, Outlet } = models;
            
            // Verify outlet
            const outlet = await Outlet.findOne({
                where: { id: outletId, businessId },
                transaction
            });
            if (!outlet) throw createHttpError(404, "Outlet not found");

            const rolls = await Roll.findAll({
                where: { outletId, businessId },
                transaction
            });

            // Calculate stats
            const stats = {
                totalRolls: rolls.length,
                activeRolls: rolls.filter(r => r.status === 'ACTIVE').length,
                finishedRolls: rolls.filter(r => r.status === 'FINISHED').length,
                totalLength: rolls.reduce((sum, r) => sum + Number(r.initialLength || 0), 0),
                usedLength: rolls.reduce((sum, r) => sum + (Number(r.initialLength || 0) - Number(r.remainingLength || 0)), 0),
                remainingLength: rolls.reduce((sum, r) => sum + Number(r.remainingLength || 0), 0),
                byType: {}
            };

            rolls.forEach(roll => {
                if (!stats.byType[roll.rollType]) {
                    stats.byType[roll.rollType] = { count: 0, total: 0, used: 0, remaining: 0 };
                }
                const initial = Number(roll.initialLength || 0);
                const remaining = Number(roll.remainingLength || 0);
                
                stats.byType[roll.rollType].count++;
                stats.byType[roll.rollType].total += initial;
                stats.byType[roll.rollType].used += (initial - remaining);
                stats.byType[roll.rollType].remaining += remaining;
            });

            return { outlet, stats, rolls };
        });

        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};

/**
 * Update roll usage
 */
exports.updateUsage = async (req, res, next) => {
    try {
        const { rollId } = req.params;
        const { businessId } = req;
        const { usedLength, notes } = req.body;

        if (usedLength === undefined || usedLength < 0) {
            throw createHttpError(400, "Valid used length is required");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Roll } = models;
            
            const roll = await Roll.findOne({
                where: { id: rollId, businessId },
                transaction
            });
            if (!roll) throw createHttpError(404, "Roll not found");
            if (roll.status === 'FINISHED') throw createHttpError(400, "Roll is already finished");

            const currentRemaining = Number(roll.remainingLength || 0);
            const newRemaining = currentRemaining - Number(usedLength);
            
            if (newRemaining < 0) throw createHttpError(400, "Usage exceeds remaining length");

            const status = newRemaining === 0 ? 'FINISHED' : 'ACTIVE';

            await roll.update({
                remainingLength: newRemaining,
                status,
                lastUsedAt: new Date()
            }, { transaction });

            return { roll, usedLength, notes };
        });

        res.json({ success: true, data: result, message: "Roll usage updated" });
    } catch (error) {
        next(error);
    }
};
