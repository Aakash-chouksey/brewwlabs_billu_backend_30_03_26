/**
 * TABLE CONTROLLER - Neon-Safe Transaction Pattern
 */

const createHttpError = require("http-errors");
const { safeQuery } = require("../utils/safeQuery");

/**
 * Get all tables
 */
exports.getTables = async (req, res, next) => {
    try {
        const { businessId } = req;
        const { areaId, status } = req.query;

        const tables = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { Table, Area } = models;
            
            const whereClause = { businessId };
            if (areaId) whereClause.areaId = areaId;
            if (status) whereClause.status = status;

            return await safeQuery(
                () => Table.findAll({
                    where: whereClause,
                    include: [{ model: Area, attributes: ['id', 'name'] }],
                    order: [['number', 'ASC']]
                }),
                []
            );
        });

        res.json({ success: true, data: tables || [] });
    } catch (error) {
        next(error);
    }
};

/**
 * Add new table
 */
exports.addTable = async (req, res, next) => {
    try {
        const { businessId } = req;
        const { number, name, areaId, capacity, status } = req.body;

        if (!number) {
            throw createHttpError(400, "Table number is required");
        }

        const table = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Table, Area } = models;
            
            // Verify area exists if provided
            if (areaId) {
                const area = await safeQuery(
                    () => Area.findOne({
                        where: { id: areaId, businessId },
                        transaction: context.transaction
                    }),
                    null
                );
                if (!area) throw createHttpError(404, "Area not found");
            }

            return await Table.create({
                businessId,
                number,
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
            
            const table = await safeQuery(
                () => Table.findOne({
                    where: { id, businessId },
                    transaction: context.transaction
                }),
                null
            );
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
            const activeOrders = await safeQuery(
                () => Order.count({
                    where: { tableId: id, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
                    transaction: context.transaction
                }),
                0
            );
            if (activeOrders > 0) {
                throw createHttpError(400, `Cannot delete table with ${activeOrders} active orders`);
            }

            const table = await safeQuery(
                () => Table.findOne({
                    where: { id, businessId },
                    transaction: context.transaction
                }),
                null
            );
            if (!table) throw createHttpError(404, "Table not found");

            await table.destroy({ transaction: context.transaction });
        });

        res.json({ success: true, message: "Table deleted" });
    } catch (error) {
        next(error);
    }
};
