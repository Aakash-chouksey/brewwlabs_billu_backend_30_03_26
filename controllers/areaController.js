/**
 * AREA CONTROLLER - Neon-Safe Transaction Pattern
 */

const createHttpError = require("http-errors");
const { safeQuery } = require("../utils/safeQuery");

/**
 * Get all areas
 */
exports.getAreas = async (req, res, next) => {
    try {
        const { businessId } = req;

        const areas = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { Area } = models;
            
            return await safeQuery(
                () => Area.findAll({
                    where: { businessId },
                    order: [['name', 'ASC']]
                }),
                []
            );
        });

        res.json({ success: true, data: areas || [] });
    } catch (error) {
        next(error);
    }
};

/**
 * Add new area
 */
exports.addArea = async (req, res, next) => {
    try {
        const { businessId } = req;
        const { name, description, capacity } = req.body;

        if (!name) {
            throw createHttpError(400, "Area name is required");
        }

        const area = await req.executeWithTenant(async (context) => {
            // Get models from context (NOT from req.models - removed by middleware)
            const { transaction, transactionModels: models } = context;
            const { Area } = models;
            
            return await Area.create({
                businessId,
                name,
                description,
                capacity: capacity || null
            }, { transaction: context.transaction });
        });

        res.status(201).json({ success: true, data: area, message: "Area created" });
    } catch (error) {
        next(error);
    }
};

/**
 * Update area
 */
exports.updateArea = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { businessId } = req;
        const updateData = req.body;

        const area = await req.executeWithTenant(async (context) => {
            // Get models from context (NOT from req.models - removed by middleware)
            const { transaction, transactionModels: models } = context;
            const { Area } = models;
            
            const area = await safeQuery(
                () => Area.findOne({
                    where: { id, businessId },
                    transaction: context.transaction
                }),
                null
            );
            if (!area) throw createHttpError(404, "Area not found");

            await area.update(updateData, { transaction: context.transaction });
            return area;
        });

        res.json({ success: true, data: area, message: "Area updated" });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete area
 */
exports.deleteArea = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { businessId } = req;

        await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Area, Table } = models;
            
            // Check if area has tables
            const tables = await safeQuery(
                () => Table.count({
                    where: { areaId: id },
                    transaction: context.transaction
                }),
                0
            );
            if (tables > 0) {
                throw createHttpError(400, `Cannot delete area with ${tables} tables`);
            }

            const area = await safeQuery(
                () => Area.findOne({
                    where: { id, businessId },
                    transaction: context.transaction
                }),
                null
            );
            if (!area) throw createHttpError(404, "Area not found");

            await area.destroy({ transaction: context.transaction });
        });

        res.json({ success: true, message: "Area deleted" });
    } catch (error) {
        next(error);
    }
};
