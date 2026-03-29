/**
 * Table Management Controller - Neon-Safe Version
 * Standardized for transaction-scoped model access
 */

const { v4: uuidv4 } = require('uuid');
const createHttpError = require('http-errors');

const tableManagementController = {
    /**
     * Get all tables
     */
    getTables: async (req, res, next) => {
        try {
            const business_id = req.business_id || req.businessId;
            const outlet_id = req.outlet_id || req.outletId;

            const tables = await req.readWithTenant(async (context) => {
                const { transactionModels: models } = context;
                const { Table, Area } = models;

                const whereClause = { businessId: business_id };
                if (outlet_id) whereClause.outletId = outlet_id;

                return await Table.findAll({
                    where: whereClause,
                    include: [{ model: Area, as: 'area' }],
                    order: [['tableNo', 'ASC']]
                });
            });

            res.json({
                success: true,
                data: tables,
                count: tables.length,
                message: "Tables retrieved successfully"
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Create table
     */
    createTable: async (req, res, next) => {
        try {
            const business_id = req.business_id || req.businessId;
            const outlet_id = req.outlet_id || req.outletId;
            const { tableNo, name, capacity, areaId, status, positionX, positionY } = req.body;

            if (!tableNo) {
                throw createHttpError(400, 'Table number is required');
            }

            const table = await req.executeWithTenant(async (context) => {
                const { transaction, transactionModels: models } = context;
                const { Table } = models;

                // Check if table number already exists within this outlet
                const existing = await Table.findOne({
                    where: { businessId: business_id, outletId: outlet_id || null, tableNo },
                    transaction
                });

                if (existing) {
                    throw createHttpError(409, 'Table with this number already exists');
                }

                return await Table.create({
                    id: uuidv4(),
                    businessId: business_id,
                    outletId: outlet_id || null,
                    tableNo,
                    name: name || `Table ${tableNo}`,
                    capacity: capacity || 4,
                    areaId: areaId || null,
                    status: status || 'AVAILABLE',
                    positionX: positionX || null,
                    positionY: positionY || null
                }, { transaction });
            });

            res.status(201).json({
                success: true,
                message: 'Table created successfully',
                data: table
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Update table
     */
    updateTable: async (req, res, next) => {
        try {
            const business_id = req.business_id || req.businessId;
            const { id } = req.params;

            const updated = await req.executeWithTenant(async (context) => {
                const { transaction, transactionModels: models } = context;
                const { Table, Area } = models;

                const table = await Table.findOne({
                    where: { id, businessId: business_id },
                    transaction
                });

                if (!table) {
                    throw createHttpError(404, 'Table not found');
                }

                const updateData = {};
                const fields = ['tableNo', 'name', 'capacity', 'areaId', 'status', 'positionX', 'positionY'];
                fields.forEach(field => {
                    if (req.body[field] !== undefined) updateData[field] = req.body[field];
                });

                await table.update(updateData, { transaction });

                return await Table.findOne({
                    where: { id, businessId: business_id },
                    include: [{ model: Area, as: 'area' }],
                    transaction
                });
            });

            res.json({
                success: true,
                message: 'Table updated successfully',
                data: updated
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Delete table
     */
    deleteTable: async (req, res, next) => {
        try {
            const business_id = req.business_id || req.businessId;
            const { id } = req.params;

            await req.executeWithTenant(async (context) => {
                const { transaction, transactionModels: models } = context;
                const { Table } = models;

                const table = await Table.findOne({
                    where: { id, businessId: business_id },
                    transaction
                });

                if (!table) {
                    throw createHttpError(404, 'Table not found');
                }

                await table.destroy({ transaction });
            });

            res.json({
                success: true,
                message: 'Table deleted successfully'
            });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = tableManagementController;
