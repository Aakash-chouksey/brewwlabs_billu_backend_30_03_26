const createHttpError = require("http-errors");
const { enforceOutletScope, buildStrictWhereClause } = require("../utils/outletGuard");
const { safeQuery } = require("../utils/safeQuery");

/**
 * Get all areas
 */
exports.getAreas = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const { businessId, outletId } = req;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { Area } = models;
            
            const { whereClause } = buildStrictWhereClause(req);
            
            return await safeQuery(
                () => Area.findAll({
                    where: whereClause,
                    order: [['name', 'ASC']]
                }),
                []
            );
        });

        console.log('[AREA CONTROLLER] getAreas result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const responseData = result.data || result;
        res.json({ success: true, data: responseData || [] });
    } catch (error) {
        next(error);
    }
};

/**
 * Add new area
 */
exports.addArea = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const { businessId, outletId } = req;
        const { name, description, capacity } = req.body;

        if (!name) {
            throw createHttpError(400, "Area name is required");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Area } = models;
            
            return await Area.create({
                businessId,
                outletId,
                name,
                description,
                capacity: capacity || 20
            }, { transaction });
        });

        console.log('[AREA CONTROLLER] addArea result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const responseData = result.data || result;
        res.status(201).json({ success: true, data: responseData, message: "Area created" });
    } catch (error) {
        next(error);
    }
};

/**
 * Update area
 */
exports.updateArea = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const { id } = req.params;
        const { businessId } = req;
        const updateData = req.body;

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Area } = models;
            
            const { whereClause } = buildStrictWhereClause(req, { id });

            const area = await safeQuery(
                () => Area.findOne({
                    where: whereClause,
                    transaction
                }),
                null
            );
            if (!area) throw createHttpError(404, "Area not found");

            await area.update(updateData, { transaction });
            return area;
        });

        console.log('[AREA CONTROLLER] updateArea result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const responseData = result.data || result;
        res.json({ success: true, data: responseData, message: "Area updated" });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete area
 */
exports.deleteArea = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const { id } = req.params;
        const { businessId } = req;

        await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Area, Table } = models;
            
            const { whereClause } = buildStrictWhereClause(req, { id });

            // Check if area has tables
            const tables = await safeQuery(
                () => Table.count({
                    where: { areaId: id },
                    transaction
                }),
                0
            );
            if (tables > 0) {
                throw createHttpError(400, `Cannot delete area with ${tables} tables`);
            }

            const area = await safeQuery(
                () => Area.findOne({
                    where: whereClause,
                    transaction
                }),
                null
            );
            if (!area) throw createHttpError(404, "Area not found");

            await area.destroy({ transaction });
        });

        res.json({ success: true, message: "Area deleted" });
    } catch (error) {
        next(error);
    }
};
