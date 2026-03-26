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
        const { businessId } = req;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { Order, OrderItem, Product, Customer, Business } = models;
            
            const order = await Order.findOne({
                where: { id: orderId, businessId },
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

            const business = await Business.findByPk(businessId);

            // Generate bill data
            const bill = {
                billNumber: `BILL-${Date.now()}`,
                orderId: order.id,
                date: new Date().toISOString(),
                business: {
                    name: business?.name || 'Unknown',
                    address: business?.address || '',
                    phone: business?.phone || ''
                },
                customer: order.Customer ? {
                    name: order.Customer.name,
                    phone: order.Customer.phone,
                    email: order.Customer.email
                } : null,
                items: (order.items || []).map(item => ({
                    name: item.product?.name || 'Unknown',
                    quantity: item.quantity,
                    unitPrice: item.price,
                    total: item.subtotal
                })),
                subtotal: order.subtotal,
                discount: order.discount,
                tax: order.tax,
                total: order.total,
                paymentStatus: order.status
            };

            return bill;
        });

        console.log('[EBILL CONTROLLER] generateEBill result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const responseData = result.data || result;
        res.json({ success: true, data: responseData });
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
        const { businessId } = req;

        if (!phone) {
            throw createHttpError(400, "Phone number is required");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Order, OrderItem, Product, Customer } = models;
            
            const order = await Order.findOne({
                where: { id: orderId, businessId },
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
            // For now, return success with mock data
            return {
                sent: true,
                phone,
                messageId: `msg_${Date.now()}`,
                timestamp: new Date().toISOString()
            };
        });

        console.log('[EBILL CONTROLLER] sendBillViaWhatsApp result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const responseData = result.data || result;
        res.json({ success: true, data: responseData, message: "Bill sent via WhatsApp" });
    } catch (error) {
        next(error);
    }
};

/**
 * Send E-Bill (alias for route compatibility)
 */
exports.sendEBill = async (req, res, next) => {
    // Delegate to sendBillViaWhatsApp or generateEBill based on request
    if (req.body.phone) {
        return exports.sendBillViaWhatsApp(req, res, next);
    }
    // Otherwise just generate the bill
    req.params.orderId = req.body.orderId || req.params.orderId;
    return exports.generateEBill(req, res, next);
};
