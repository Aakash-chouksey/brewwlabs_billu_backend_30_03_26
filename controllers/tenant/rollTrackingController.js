/**
 * ROLL TRACKING CONTROLLER - Neon-Safe Version
 * Standardized for transaction-scoped model access and consistent multi-tenancy.
 */

const createHttpError = require("http-errors");

/**
 * Add roll
 */
exports.addRoll = async (req, res, next) => {
    try {
        const business_id = req.business_id || req.businessId;
        const outlet_id = req.outlet_id || req.outletId;
        const { rollType, initialLength, batchNumber, supplierId } = req.body;

        if (!outlet_id) {
            throw createHttpError(400, "Outlet ID is required for roll registration");
        }
        if (!rollType || !initialLength) {
            throw createHttpError(400, "Roll type and initial length are required");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Roll, Outlet } = models;
            
            const outlet = await Outlet.findOne({
                where: { id: outlet_id, businessId: business_id },
                transaction
            });
            if (!outlet) throw createHttpError(404, "Outlet not found");

            return await Roll.create({
                businessId: business_id,
                outletId: outlet_id,
                rollType,
                initialLength,
                remainingLength: initialLength,
                batchNumber,
                supplierId,
                status: 'ACTIVE',
                addedBy: req.auth?.id || req.user?.id
            }, { transaction });
        });

        const data = result.data || result;
        res.status(201).json({ 
            success: true, 
            data: data, 
            message: "Roll added successfully" 
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get roll stats for outlet
 */
exports.getRollStats = async (req, res, next) => {
    try {
        const { outletId: paramOutletId } = req.params;
        const business_id = req.business_id || req.businessId;
        const outlet_id = paramOutletId || req.outlet_id || req.outletId;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { Roll, Outlet } = models;
            
            const outlet = await Outlet.findOne({
                where: { id: outlet_id, businessId: business_id }
            });
            if (!outlet) throw createHttpError(404, "Outlet not found");

            const rolls = await Roll.findAll({
                where: { outletId: outlet_id, businessId: business_id }
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

        const data = result.data || result;
        res.json({ 
            success: true, 
            data: data,
            message: "Roll statistics retrieved successfully"
        });
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
        const business_id = req.business_id || req.businessId;
        const { usedLength, notes } = req.body;

        if (usedLength === undefined || usedLength < 0) {
            throw createHttpError(400, "Valid used length is required");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Roll } = models;
            
            const roll = await Roll.findOne({
                where: { id: rollId, businessId: business_id },
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

        const data = result.data || result;
        res.json({ 
            success: true, 
            data: data, 
            message: "Roll usage updated successfully" 
        });
    } catch (error) {
        next(error);
    }
};
