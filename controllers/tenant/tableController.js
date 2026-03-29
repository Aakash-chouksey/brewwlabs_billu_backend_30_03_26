/**
 * TABLE CONTROLLER - Neon-Safe Transaction Pattern
 */

const createHttpError = require("http-errors");

/**
 * Get all tables
 */
exports.getTables = async (req, res, next) => {
    try {
        const { businessId, outletId } = req;
        const { areaId, status } = req.query;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { Table, Area } = models;
            
            const whereClause = { businessId };
            if (outletId) whereClause.outletId = outletId;
            if (areaId) whereClause.areaId = areaId;
            if (status) whereClause.status = status;

            const tables = await Table.findAll({
                where: whereClause,
                include: [{ model: Area, as: 'area', attributes: ['id', 'name'] }],
                order: [['tableNo', 'ASC']]
            });
            
            return tables || [];
        });

        const responseData = result.data || result || [];
        res.json({ success: true, data: responseData });
    } catch (error) {
        next(error);
    }
};

/**
 * Add new table
 */
exports.addTable = async (req, res, next) => {
    try {
        const { businessId, outletId } = req;
        const { tableNo, name, areaId, capacity, status } = req.body;

        if (!tableNo) {
            throw createHttpError(400, "Table number is required");
        }

        if (!outletId) {
            throw createHttpError(400, "Outlet ID is required");
        }

        const table = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Table, Area } = models;
            
            // Verify area exists if provided
            if (areaId) {
                const area = await Area.findOne({
                    where: { id: areaId, businessId },
                    transaction: context.transaction
                });
                if (!area) throw createHttpError(404, "Area not found");
            }

            return await Table.create({
                businessId,
                outletId,
                tableNo,
                name,
                areaId,
                capacity: capacity || 4,
                status: status || 'AVAILABLE'
            }, { transaction: context.transaction });
        });

        res.status(201).json({ success: true, data: table, message: "Table created" });
    } catch (error) {
        next(error);
    }
};

/**
 * Update table
 */
exports.updateTable = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { businessId } = req;
        const updateData = req.body;

        const table = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Table } = models;
            
            const table = await Table.findOne({
                where: { id, businessId },
                transaction: context.transaction
            });
            if (!table) throw createHttpError(404, "Table not found");

            await table.update(updateData, { transaction: context.transaction });
            return table;
        });

        res.json({ success: true, data: table, message: "Table updated" });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete table
 */
exports.deleteTable = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { businessId } = req;

        await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Table, Order } = models;
            
            // Check if table has active orders
            const activeOrders = await Order.count({
                where: { tableId: id, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
                transaction: context.transaction
            });
            if (activeOrders > 0) {
                throw createHttpError(400, `Cannot delete table with ${activeOrders} active orders`);
            }

            const table = await Table.findOne({
                where: { id, businessId },
                transaction: context.transaction
            });
            if (!table) throw createHttpError(404, "Table not found");

            await table.destroy({ transaction: context.transaction });
        });

        res.json({ success: true, message: "Table deleted" });
    } catch (error) {
        next(error);
    }
};
