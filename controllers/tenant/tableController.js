/**
 * TABLE CONTROLLER - Neon-Safe Transaction Pattern
 */

const createHttpError = require("http-errors");
const TableConsistencyService = require("../../services/tableConsistencyService");
const { Op } = require("sequelize");

/**
 * Get all tables
 */
exports.getTables = async (req, res, next) => {
    try {
        console.log(`🔍 [TableController] Fetching tables | Business: ${req.businessId} | Outlet: ${req.outletId}`);
        const { businessId, outletId } = req;
        const { areaId, status, runConsistencyCheck = 'false' } = req.query;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { Table, Area, Order } = models;
            
            // Run consistency check if requested
            if (runConsistencyCheck === 'true') {
                console.log(`🔧 [TableController] Running consistency check before fetching tables`);
                await TableConsistencyService.runConsistencyCheck(models, businessId, outletId);
            }
            
            const whereClause = { businessId };
            if (outletId) whereClause.outletId = outletId;
            if (areaId) whereClause.areaId = areaId;
            if (status) whereClause.status = status;

            const tables = await Table.findAll({
                where: whereClause,
                include: [
                    { model: Area, as: 'area', attributes: ['id', 'name'] },
                    {
                        model: Order,
                        as: 'orders',
                        where: {
                            status: { [Op.in]: ['CREATED', 'KOT_SENT'] }
                        },
                        required: false,
                        attributes: ['id', 'orderNumber', 'status', 'createdAt']
                    }
                ],
                order: [['tableNo', 'ASC']]
            });
            
            // Validate and correct table statuses
            const validatedTables = await Promise.all(
                tables.map(async table => {
                    const validated = await TableConsistencyService.validateTableStatus(table, models);
                    // Ensure currentOrderId is always at the root for frontend consumption
                    return {
                        ...validated,
                        currentOrderId: validated.currentOrderId || (validated.orders && validated.orders[0]?.id) || null
                    };
                })
            );
            
            return validatedTables || [];
        });

        const responseData = result.data || result || [];
        console.log(`🔍 [TableController] Returning ${responseData.length} tables`);
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
        console.log(`🔍 [TableController] STEP 1: Add table request received | Business: ${req.businessId} | Outlet: ${req.outletId}`);
        console.log(`🔍 [TableController] STEP 1: Request body:`, JSON.stringify(req.body, null, 2));
        
        const { businessId, outletId } = req;
        const { tableNo, name, areaId, capacity, status } = req.body;

        console.log(`🔍 [TableController] STEP 2: Parsed parameters | TableNo: ${tableNo} | Name: ${name} | Area: ${areaId} | Capacity: ${capacity} | Status: ${status}`);

        if (!tableNo) {
            console.log(`🚨 [TableController] STEP 3: VALIDATION FAILED - Table number is required`);
            throw createHttpError(400, "Table number is required");
        }
        console.log(`🔍 [TableController] STEP 3: Table number validation passed`);

        if (!outletId) {
            console.log(`🚨 [TableController] STEP 3: VALIDATION FAILED - Outlet ID is required`);
            throw createHttpError(400, "Outlet ID is required");
        }
        console.log(`🔍 [TableController] STEP 3: Outlet ID validation passed`);

        const table = await req.executeWithTenant(async (context) => {
            console.log(`🔍 [TableController] STEP 4: Transaction started`);
            const { transaction, transactionModels: models } = context;
            const { Table, Area } = models;
            
            // Verify area exists if provided
            if (areaId) {
                console.log(`🔍 [TableController] STEP 5: Validating area ${areaId}`);
                const area = await Area.findOne({
                    where: { id: areaId, businessId },
                    transaction: context.transaction
                });
                if (!area) {
                    console.log(`🚨 [TableController] STEP 5: AREA NOT FOUND - Area ID: ${areaId}`);
                    throw createHttpError(404, "Area not found");
                }
                console.log(`🔍 [TableController] STEP 5: Area validation passed`);
            }

            console.log(`🔍 [TableController] STEP 6: Creating table...`);
            const newTable = await Table.create({
                businessId,
                outletId,
                tableNo,
                name,
                areaId,
                capacity: capacity || 4,
                status: status || 'AVAILABLE'
            }, { transaction: context.transaction });
            console.log(`🔍 [TableController] STEP 6: Table created - ID: ${newTable.id} | TableNo: ${newTable.tableNo}`);
            
            return newTable;
        });

        console.log(`🔍 [TableController] STEP 7: Transaction completed - Sending response`);
        res.status(201).json({ success: true, data: table, message: "Table created" });
    } catch (error) {
        console.log(`🚨 [TableController] ERROR: ${error.message}`);
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
            
            // Sync status from orders after manual update to prevent inconsistencies
            await TableConsistencyService.syncStatusFromOrders(id, models, { transaction });
            
            return table;
        });

        // Emit TABLE_UPDATED socket event after manual update
        if (table) {
            const socketService = require("../../services/socketService");
            const business_id = req.business_id || req.businessId;
            const outlet_id = req.outlet_id || req.outletId;
            
            socketService.emitToOutlet(outlet_id, "TABLE_UPDATED", {
                tableId: table.id,
                status: table.status,
                currentOrderId: table.currentOrderId,
                timestamp: new Date().toISOString()
            });
        }

        res.json({ success: true, data: table, message: "Table updated and synced" });
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
