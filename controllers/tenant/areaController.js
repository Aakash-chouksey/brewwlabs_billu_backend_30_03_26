/**
 * AREA CONTROLLER - Neon-Safe Transaction Pattern
 */

const createHttpError = require("http-errors");

/**
 * Get all areas
 */
exports.getAreas = async (req, res, next) => {
    try {
        const business_id = req.business_id || req.businessId;
        const outlet_id = req.outlet_id || req.outletId;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { Area } = models;
            
            const whereClause = { businessId: business_id };
            if (outlet_id) whereClause.outletId = outlet_id;
            
            const areas = await Area.findAll({
                where: whereClause,
                order: [['name', 'ASC']]
            });
            
            return areas || [];
        });

        const responseData = result.data || result || [];
        res.json({ 
            success: true, 
            data: responseData,
            message: "Areas retrieved successfully"
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Add new area
 */
exports.addArea = async (req, res, next) => {
    try {
        const business_id = req.business_id || req.businessId;
        const outlet_id = req.outlet_id || req.outletId;
        const { name, description, capacity } = req.body;

        if (!name) {
            throw createHttpError(400, "Area name is required");
        }

        if (!outlet_id) {
            throw createHttpError(400, "outlet_id is required");
        }

        const area = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Area } = models;
            
            return await Area.create({
                businessId: business_id,
                outletId: outlet_id,
                name,
                description,
                capacity: capacity || null
            }, { transaction });
        });

        res.status(201).json({ 
            success: true, 
            data: area, 
            message: "Area created successfully" 
        });
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
        const business_id = req.business_id || req.businessId;
        const updateData = req.body;

        const area = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Area } = models;
            
            const area = await Area.findOne({
                where: { id, businessId: business_id },
                transaction
            });
            if (!area) throw createHttpError(404, "Area not found");

            await area.update(updateData, { transaction });
            return area;
        });

        res.json({ 
            success: true, 
            data: area, 
            message: "Area updated successfully" 
        });
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
        const business_id = req.business_id || req.businessId;

        await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Area, Table } = models;
            
            // Check if area has tables
            const tables = await Table.count({
                where: { areaId: id },
                transaction
            });
            if (tables > 0) {
                throw createHttpError(400, `Cannot delete area with ${tables} tables`);
            }

            const area = await Area.findOne({
                where: { id, businessId: business_id },
                transaction
            });
            if (!area) throw createHttpError(404, "Area not found");

            await area.destroy({ transaction });
        });

        res.json({ 
            success: true, 
            message: "Area deleted successfully" 
        });
    } catch (error) {
        next(error);
    }
};
