/**
 * SETTLEMENT CONTROLLER - Atomic Order Closing & Payment
 * Handles the transition from SERVED to COMPLETED/CLOSED with payment records
 */

const createHttpError = require("http-errors");
const socketService = require("../../services/socketService");

const settlementController = {
    /**
     * Settle an order (Payment + Close)
     */
    settleOrder: async (req, res, next) => {
        try {
            const { id } = req.params; // Order ID
            const { paymentMethod, amountPaid, transactionReference, notes } = req.body;
            const business_id = req.business_id || req.businessId;
            const outlet_id = req.outlet_id || req.outletId;

            if (!paymentMethod || !amountPaid) {
                throw createHttpError(400, "Payment method and amount paid are required for settlement");
            }

            const result = await req.executeWithTenant(async (context) => {
                const { transaction, transactionModels: models } = context;
                const { Order, Payment, Table, OrderItem, Product } = models;

                // 1. Fetch Order with items
                const order = await Order.findOne({
                    where: { id, businessId: business_id, outletId: outlet_id },
                    include: [{ model: OrderItem, as: 'items' }],
                    transaction
                });

                if (!order) throw createHttpError(404, "Order not found");
                if (order.status === 'COMPLETED' || order.status === 'CLOSED') {
                    throw createHttpError(400, "Order is already settled");
                }

                // 2. Create Payment Record
                const payment = await Payment.create({
                    businessId: business_id,
                    outletId: outlet_id,
                    internalOrderId: order.id,
                    amount: amountPaid,
                    method: paymentMethod,
                    status: 'SUCCESS',
                    paymentId: transactionReference || `CASH-${Date.now()}`,
                    notes: notes || 'Settled at POS'
                }, { transaction });

                // 3. Update Order Status
                order.status = 'COMPLETED';
                order.paymentId = payment.id;
                await order.save({ transaction });

                // 4. Update Table Status (Release table)
                if (order.tableId) {
                    await Table.update(
                        { 
                            status: 'AVAILABLE',
                            currentOrderId: null
                        },
                        { where: { id: order.tableId, businessId: business_id }, transaction }
                    );
                    
                    console.log(`🔧 [SettlementController] Table ${order.tableId} released in DB`);
                }

                // 5. Fetch Final State for Response & Socket
                return await Order.findByPk(order.id, {
                    include: [
                        { model: OrderItem, as: 'items', include: [{ model: Product, as: 'product' }] },
                        { model: Table, as: 'table' },
                        { model: Payment, as: 'payments' }
                    ],
                    transaction
                });
            });

            const settledOrder = result.data || result;

            // 6. Notify via Sockets
            socketService.emitToOutlet(outlet_id, "ORDER_UPDATED", settledOrder);
            socketService.emitToOutlet(outlet_id, "ORDER_SETTLED", settledOrder);

            // 7. Notify Table Status Update (Post-commit)
            if (settledOrder && settledOrder.tableId) {
                console.log(`🔧 [SettlementController] Emitting post-commit TABLE_UPDATED for Table: ${settledOrder.tableId}`);
                socketService.emitToOutlet(outlet_id, "TABLE_UPDATED", {
                    tableId: settledOrder.tableId,
                    status: 'AVAILABLE',
                    orderId: null,
                    timestamp: new Date().toISOString()
                });
            }

            res.json({
                success: true,
                data: settledOrder,
                message: "Order settled and closed successfully"
            });

        } catch (error) {
            next(error);
        }
    }
};

module.exports = settlementController;
