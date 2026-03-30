/**
 * TABLE CONSISTENCY SERVICE
 * Ensures table status is always consistent with order state
 */

const { Op } = require('sequelize');

class TableConsistencyService {
    /**
     * Run consistency check and auto-correct table statuses
     */
    static async runConsistencyCheck(models, businessId, outletId = null) {
        console.log(`🔧 [TableConsistency] Starting consistency check | Business: ${businessId} | Outlet: ${outletId || 'ALL'}`);
        
        const { Table, Order } = models;
        const corrections = [];
        const totalChecked = 0;

        try {
            // Find all tables for the business/outlet
            const tableWhere = { businessId };
            if (outletId) tableWhere.outletId = outletId;

            const tables = await Table.findAll({
                where: tableWhere,
                include: [{
                    model: Order,
                    as: 'orders',
                    where: {
                        status: { [Op.notIn]: ['COMPLETED', 'CLOSED', 'CANCELLED'] }
                    },
                    required: false
                }]
            });

            for (const table of tables) {
                const activeOrders = table.orders || [];
                const hasActiveOrder = activeOrders.length > 0;

                // Case 1: Table marked OCCUPIED but no active orders
                if (table.status === 'OCCUPIED' && !hasActiveOrder) {
                    console.log(`🔧 [TableConsistency] AUTO-CORRECT: Table ${table.id} (${table.name}) marked OCCUPIED but no active orders`);
                    await Table.update(
                        { status: 'AVAILABLE', currentOrderId: null },
                        { where: { id: table.id } }
                    );
                    corrections.push({
                        tableId: table.id,
                        tableName: table.name,
                        issue: 'OCCUPIED_WITHOUT_ACTIVE_ORDER',
                        correction: 'Set to AVAILABLE',
                        previousStatus: table.status,
                        newStatus: 'AVAILABLE'
                    });
                }

                // Case 2: Table marked AVAILABLE but has active orders
                if (table.status === 'AVAILABLE' && hasActiveOrder) {
                    const activeOrder = activeOrders[0]; // Take the first active order
                    console.log(`🔧 [TableConsistency] AUTO-CORRECT: Table ${table.id} (${table.name}) marked AVAILABLE but has active order ${activeOrder.id}`);
                    await Table.update(
                        { status: 'OCCUPIED', currentOrderId: activeOrder.id },
                        { where: { id: table.id } }
                    );
                    corrections.push({
                        tableId: table.id,
                        tableName: table.name,
                        issue: 'AVAILABLE_WITH_ACTIVE_ORDER',
                        correction: 'Set to OCCUPIED',
                        previousStatus: table.status,
                        newStatus: 'OCCUPIED',
                        orderId: activeOrder.id
                    });
                }

                // Case 3: Table has currentOrderId but order is not active
                if (table.currentOrderId) {
                    const currentOrder = await Order.findOne({
                        where: {
                            id: table.currentOrderId,
                            status: { [Op.notIn]: ['COMPLETED', 'CLOSED', 'CANCELLED'] }
                        }
                    });

                    if (!currentOrder) {
                        console.log(`🔧 [TableConsistency] AUTO-CORRECT: Table ${table.id} has currentOrderId ${table.currentOrderId} but order is not active`);
                        await Table.update(
                            { currentOrderId: null },
                            { where: { id: table.id } }
                        );
                        corrections.push({
                            tableId: table.id,
                            tableName: table.name,
                            issue: 'STALE_CURRENT_ORDER_ID',
                            correction: 'Cleared currentOrderId',
                            staleOrderId: table.currentOrderId
                        });
                    }
                }
            }

            console.log(`🔧 [TableConsistency] Consistency check completed | Corrections: ${corrections.length}`);
            return {
                success: true,
                corrections,
                totalTables: tables.length,
                correctedTables: corrections.length
            };

        } catch (error) {
            console.error(`🚨 [TableConsistency] Error during consistency check:`, error);
            return {
                success: false,
                error: error.message,
                corrections: []
            };
        }
    }

    /**
     * Validate table status before returning to client
     */
    static async validateTableStatus(table, models) {
        const { Order } = models;
        
        if (table.status === 'OCCUPIED' && table.currentOrderId) {
            // Verify the current order is still active
            const currentOrder = await Order.findOne({
                where: {
                    id: table.currentOrderId,
                    status: { [Op.notIn]: ['COMPLETED', 'CLOSED', 'CANCELLED'] }
                }
            });

            if (!currentOrder) {
                // Auto-correct and return corrected status
                await table.update({ status: 'AVAILABLE', currentOrderId: null });
                return { ...table.toJSON(), status: 'AVAILABLE', currentOrderId: null };
            }
        }

        return table.toJSON();
    }

    /**
     * Get real table status based on active orders
     */
    static async getRealTableStatus(tableId, models) {
        const { Order } = models;
        
        const activeOrder = await Order.findOne({
            where: {
                tableId,
                status: { [Op.notIn]: ['COMPLETED', 'CLOSED', 'CANCELLED', 'ARCHIVED'] }
            },
            order: [['createdAt', 'DESC']]
        });

        if (activeOrder) {
            return {
                status: 'OCCUPIED',
                currentOrderId: activeOrder.id,
                orderNumber: activeOrder.orderNumber
            };
        }

        return {
            status: 'AVAILABLE',
            currentOrderId: null
        };
    }

    /**
     * Force synchronization of table status from its orders
     * USE THIS in any lifecycle event (creation, completion, cancellation)
     */
    static async syncStatusFromOrders(tableId, models, options = {}) {
        const { transaction } = options;
        const { Table } = models;
        
        console.log(`🔧 [TableConsistency] Syncing status from orders for table ${tableId}`);
        
        const realStatus = await this.getRealTableStatus(tableId, models);
        
        const [updatedRows] = await Table.update(
            { 
                status: realStatus.status,
                currentOrderId: realStatus.currentOrderId
            },
            { 
                where: { id: tableId },
                transaction
            }
        );

        if (updatedRows > 0) {
            console.log(`🔧 [TableConsistency] Table ${tableId} synced successfully to ${realStatus.status}`);
        }
        
        return realStatus;
    }
}

module.exports = TableConsistencyService;
