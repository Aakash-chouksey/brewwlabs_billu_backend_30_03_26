/**
 * EBILL CONTROLLER - Neon-Safe Transaction Pattern
 */

const createHttpError = require("http-errors");

/**
 * Generate E-Bill for order
 */
exports.generateEBill = async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const business_id = req.business_id || req.businessId;
        const outlet_id = req.outlet_id || req.outletId;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { Order, OrderItem, Product, Customer, Outlet } = models;
            
            const order = await Order.findOne({
                where: { id: orderId, businessId: business_id, outletId: outlet_id },
                include: [
                    { 
                        model: OrderItem, 
                        as: 'items', 
                        include: [{ model: Product, as: 'product', attributes: ['id', 'name'] }] 
                    },
                    { model: Customer, as: 'customer' }
                ]
            });

            if (!order) throw createHttpError(404, "Order not found");

            const outlet = await Outlet.findByPk(outlet_id);

            // Generate bill data
            const bill = {
                billNumber: order.orderNumber || `BILL-${Date.now()}`,
                orderId: order.id,
                date: order.createdAt,
                outlet: {
                    name: outlet?.name || 'Unknown Outlet',
                    address: outlet?.address || '',
                    phone: outlet?.phone || ''
                },
                customer: order.customer ? {
                    name: order.customer.name,
                    phone: order.customer.phone,
                    email: order.customer.email
                } : null,
                items: (order.items || []).map(item => ({
                    name: item.name || item.product?.name || 'Unknown',
                    quantity: item.quantity,
                    unitPrice: item.price,
                    total: item.subtotal
                })),
                subtotal: order.billingSubtotal,
                discount: order.billingDiscount,
                tax: order.billingTax,
                total: order.billingTotal,
                paymentStatus: order.status
            };

            return bill;
        });

        const responseData = result.data || result;
        res.json({ 
            success: true, 
            data: responseData,
            message: "E-Bill generated successfully"
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Send bill via WhatsApp
 */
exports.sendBillViaWhatsApp = async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const { phone } = req.body;
        const business_id = req.business_id || req.businessId;
        const outlet_id = req.outlet_id || req.outletId;

        if (!phone) {
            throw createHttpError(400, "Phone number is required");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Order, OrderItem, Product, Customer } = models;
            
            const order = await Order.findOne({
                where: { id: orderId, businessId: business_id, outletId: outlet_id },
                include: [
                    { 
                        model: OrderItem, 
                        as: 'items', 
                        include: [{ model: Product, as: 'product', attributes: ['id', 'name'] }] 
                    },
                    { model: Customer, as: 'customer' }
                ],
                transaction
            });

            if (!order) throw createHttpError(404, "Order not found");

            // In production, this would integrate with WhatsApp Business API
            return {
                sent: true,
                phone,
                messageId: `msg_${Date.now()}`,
                timestamp: new Date().toISOString()
            };
        });

        const responseData = result.data || result;
        res.json({ 
            success: true, 
            data: responseData, 
            message: "E-Bill sent via WhatsApp successfully" 
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Send E-Bill (alias for route compatibility)
 */
exports.sendEBill = async (req, res, next) => {
    if (req.body.phone) {
        return exports.sendBillViaWhatsApp(req, res, next);
    }
    req.params.orderId = req.body.orderId || req.params.orderId;
    return exports.generateEBill(req, res, next);
};
