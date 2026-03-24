/**
 * PAYMENT CONTROLLER - Neon-Safe Transaction Pattern
 */

const createHttpError = require("http-errors");

/**
 * Create Razorpay order
 */
exports.createOrder = async (req, res, next) => {
    try {
        res.status(501).json({ 
            success: false, 
            message: "Razorpay order creation - Feature not implemented" 
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Verify Razorpay payment
 */
exports.verifyPayment = async (req, res, next) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount, method, orderId } = req.body;
        const { businessId } = req;

        if (!razorpay_order_id || !razorpay_payment_id) {
            throw createHttpError(400, "Order ID and Payment ID are required");
        }

        // ⚠️ STUB: In production, verify the signature using Razorpay SDK
        const verified = true; 

        if (!verified) {
            throw createHttpError(400, "Invalid payment signature");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Payment, Order } = models;
            
            // Create payment record
            const payment = await Payment.create({
                businessId,
                orderId: razorpay_order_id,
                paymentId: razorpay_payment_id,
                amount: amount || 0,
                status: 'SUCCESS',
                method: method || 'razorpay'
            }, { transaction });

            // Update order status if linked
            if (orderId) {
                await Order.update(
                    { status: 'PAID', paymentId: payment.id },
                    { where: { id: orderId, businessId }, transaction }
                );
            }

            return payment;
        });

        res.json({ success: true, data: result, message: "Payment verified (Sandbox Mode)" });
    } catch (error) {
        next(error);
    }
};

/**
 * Handle Razorpay webhook
 */
exports.webHookVerification = async (req, res, next) => {
    try {
        res.status(501).json({ 
            success: false, 
            message: "Razorpay webhook - Feature not implemented" 
        });
    } catch (error) {
        next(error);
    }
};
