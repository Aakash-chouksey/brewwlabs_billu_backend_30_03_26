const createHttpError = require("http-errors");
const { enforceOutletScope, buildStrictWhereClause } = require("../utils/outletGuard");
const { safeQuery } = require("../utils/safeQuery");

/**
 * Get all tables
 */
exports.getTables = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const { businessId, outletId } = req;
        const { areaId, status } = req.query;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { Table, Area } = models;
            
            const { whereClause } = buildStrictWhereClause(req);
            if (areaId) whereClause.areaId = areaId;
            if (status) whereClause.status = status;

            return await safeQuery(
                () => Table.findAll({
                    where: whereClause,
                    include: [{ model: Area, attributes: ['id', 'name'] }],
                    order: [['name', 'ASC']]
                }),
                []
            );
        });

        console.log('[TABLE CONTROLLER] getTables result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const responseData = result.data || result;
        res.json({ success: true, data: responseData || [] });
    } catch (error) {
        next(error);
    }
};

/**
 * Add new table
 */
exports.addTable = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const { businessId, outletId } = req;
        const { number, name, areaId, capacity, status } = req.body;

        if (!name) {
            throw createHttpError(400, "Table name is required");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Table, Area } = models;
            
            // Verify area exists if provided
            if (areaId) {
                const area = await safeQuery(
                    () => Area.findOne({
                        where: { id: areaId, businessId, outletId },
                        transaction
                    }),
                    null
                );
                if (!area) throw createHttpError(404, "Area not found");
            }

            return await Table.create({
                businessId,
                outletId,
                number: number || name,
                name,
                areaId,
                capacity: capacity || 4,
                status: status || 'AVAILABLE'
            }, { transaction });
        });

        console.log('[TABLE CONTROLLER] addTable result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const responseData = result.data || result;
        res.status(201).json({ success: true, data: responseData, message: "Table created" });
    } catch (error) {
        next(error);
    }
};

/**
 * Update table
 */
exports.updateTable = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const { id } = req.params;
        const { businessId } = req;
        const updateData = req.body;

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Table } = models;
            
            const { whereClause } = buildStrictWhereClause(req, { id });

            const table = await safeQuery(
                () => Table.findOne({
                    where: whereClause,
                    transaction
                }),
                null
            );
            if (!table) throw createHttpError(404, "Table not found");

            await table.update(updateData, { transaction });
            return table;
        });

        console.log('[TABLE CONTROLLER] updateTable result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const responseData = result.data || result;
        res.json({ success: true, data: responseData, message: "Table updated" });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete table
 */
exports.deleteTable = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const { id } = req.params;
        const { businessId } = req;

        await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Table, Order } = models;
            
            const { whereClause } = buildStrictWhereClause(req, { id });

            // Check if table has active orders
            const activeOrders = await safeQuery(
                () => Order.count({
                    where: { tableId: id, status: { [Op.notIn]: ['COMPLETED', 'CANCELLED'] } },
                    transaction
                }),
                0
            );
            if (activeOrders > 0) {
                throw createHttpError(400, `Cannot delete table with ${activeOrders} active orders`);
            }

            const table = await safeQuery(
                () => Table.findOne({
                    where: whereClause,
                    transaction
                }),
                null
            );
            if (!table) throw createHttpError(404, "Table not found");

            await table.destroy({ transaction });
        });

        res.json({ success: true, message: "Table deleted" });
    } catch (error) {
        next(error);
    }
};
