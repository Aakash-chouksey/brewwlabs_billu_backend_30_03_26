/**
 * KITCHEN CONTROLLER - Kitchen Order Ticket (KOT) Management
 * Handles kitchen-specific operations and KOT display
 */

const { Op } = require('sequelize');
const { enforceOutletScope, buildStrictWhereClause } = require('../../utils/outletGuard');
const { STATUS_FLOW, ORDER_STATUS } = require('../../src/config/orderStatuses');
const { BadRequestError } = require('../../utils/errors');

const kitchenController = {
    /**
     * Get kitchen orders (KOT - Kitchen Order Tickets)
     * Orders that are ready for kitchen preparation
     */
    getKitchenOrders: async (req, res, next) => {
        try {
            console.log(`🍳 [KitchenController] Fetching kitchen orders | Business: ${req.business_id} | Outlet: ${req.headers['x-outlet-id']}`);
            
            const business_id = req.business_id || req.businessId;
            const outlet_id = req.outlet_id || req.outletId;

            const result = await req.readWithTenant(async (context) => {
                const { transactionModels: models } = context;
                const { Order, OrderItem, Product, Table, Customer } = models;

                return await Order.findAll({
                    where: {
                        businessId: business_id,
                        outletId: outlet_id,
                        status: { [Op.in]: [ORDER_STATUS.KOT_SENT, ORDER_STATUS.PREPARING, ORDER_STATUS.IN_PROGRESS] }
                    },
                    include: [
                        { 
                            model: OrderItem, 
                            as: 'items', 
                            include: [{ 
                                model: Product, 
                                as: 'product',
                                attributes: ['id', 'name', 'sku', 'preparationTime']
                            }] 
                        },
                        { model: Table, as: 'table', attributes: ['id', 'name', 'tableNo'] },
                        { model: Customer, as: 'customer', attributes: ['id', 'name'] }
                    ],
                    order: [
                        ['created_at', 'ASC'], // Oldest orders first for kitchen priority
                        ['id', 'ASC']
                    ],
                    limit: 50
                });
            });

            const data = result.data || result || [];
            
            console.log(`🍳 [KitchenController] Found ${data.length} kitchen orders`);

            res.json({
                success: true,
                data: data,
                count: data.length,
                message: "Kitchen orders retrieved successfully"
            });

        } catch (error) {
            console.error(`🍳 [KitchenController] Error: ${error.message}`);
            next(error);
        }
    },

    /**
     * Update kitchen order status
     * KOT -> IN_PROGRESS -> READY
     */
    updateKitchenOrderStatus: async (req, res, next) => {
        try {
            enforceOutletScope(req);
            const { id } = req.params;
            const { status } = req.body;
            const business_id = req.business_id || req.businessId;
            const outlet_id = req.outlet_id || req.outletId;

            console.log(`🍳 [KitchenController] Updating order ${id} to status: ${status}`);

            // Validate status transition
            const allowedStatuses = Object.values(ORDER_STATUS);
            if (!allowedStatuses.includes(status)) {
                throw new BadRequestError(`Invalid kitchen status. Allowed: ${['PREPARING', 'READY', 'CANCELLED'].join(', ')}`);
            }

            const result = await req.executeWithTenant(async (context) => {
                const { transaction, transactionModels: models } = context;
                const { Order } = models;
                
                const { whereClause } = buildStrictWhereClause(req, { id });

                const order = await Order.findOne({
                    where: whereClause,
                    transaction
                });

                if (!order) {
                    throw new Error("Order not found");
                }

                // Validate current status
                const validTransitions = STATUS_FLOW;

                const currentStatus = order.status;
                const allowedNext = STATUS_FLOW[currentStatus] || [];
                
                console.log(`🔍 [KitchenController] TRANSITION ATTEMPT: ${currentStatus} -> ${status}`);
                console.log(`🔍 [KitchenController] ALLOWED FOR ${currentStatus}:`, JSON.stringify(allowedNext));

                if (!allowedNext.includes(status)) {
                    throw new BadRequestError(`Invalid status transition from ${currentStatus} to ${status}`);
                }

                // Update order status
                await order.update({ status }, { transaction });

                // Fetch updated order with associations
                const updatedOrder = await Order.findByPk(id, {
                    include: [
                        { 
                            model: OrderItem, 
                            as: 'items', 
                            include: [{ model: Product, as: 'product' }] 
                        },
                        { model: Table, as: 'table' },
                        { model: Customer, as: 'customer' }
                    ],
                    transaction
                });

                return updatedOrder;
            });

            const responseData = result.data || result;
            
            // CRITICAL: Emit real-time update AFTER transaction is committed
            const socketService = require('../../services/socketService');
            socketService.emitToOutlet(outlet_id, "ORDER_UPDATED", responseData);
            socketService.emitToOutlet(outlet_id, "KITCHEN_ORDER_UPDATED", responseData);

            res.json({
                success: true,
                data: responseData,
                message: `Order status updated to ${status}`
            });

        } catch (error) {
            console.error(`🍳 [KitchenController] Error: ${error.message}`);
            next(error);
        }
    },

    /**
     * Get kitchen statistics
     */
    getKitchenStats: async (req, res, next) => {
        try {
            const business_id = req.business_id || req.businessId;
            const outlet_id = req.outlet_id || req.outletId;

            const result = await req.readWithTenant(async (context) => {
                const { transactionModels: models } = context;
                const { Order } = models;

                const [
                    kotSentCount,
                    preparingCount,
                    readyCount,
                    todayOrdersCount
                ] = await Promise.all([
                    Order.count({
                        where: {
                            businessId: business_id,
                            outletId: outlet_id,
                            status: ORDER_STATUS.KOT_SENT
                        }
                    }),
                    Order.count({
                        where: {
                            businessId: business_id,
                            outletId: outlet_id,
                            status: { [Op.in]: [ORDER_STATUS.PREPARING, ORDER_STATUS.IN_PROGRESS] }
                        }
                    }),
                    Order.count({
                        where: {
                            businessId: business_id,
                            outletId: outlet_id,
                            status: 'READY'
                        }
                    }),
                    Order.count({
                        where: {
                            businessId: business_id,
                            outletId: outlet_id,
                            createdAt: {
                                [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0))
                            }
                        }
                    })
                ]);

                return {
                    kotSent: kotSentCount,
                    preparing: preparingCount,
                    ready: readyCount,
                    todayOrders: todayOrdersCount,
                    totalActive: kotSentCount + preparingCount + readyCount
                };
            });

            const data = result.data || result;

            res.json({
                success: true,
                data: data,
                message: "Kitchen statistics retrieved successfully"
            });

        } catch (error) {
            console.error(`🍳 [KitchenController] Error: ${error.message}`);
            next(error);
        }
    }
};

module.exports = kitchenController;
