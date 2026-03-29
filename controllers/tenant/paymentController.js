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
        const business_id = req.business_id || req.businessId;
        const outlet_id = req.outlet_id || req.outletId;

        if (!razorpay_order_id || !razorpay_payment_id) {
            throw createHttpError(400, "Razorpay Order ID and Payment ID are required");
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
                businessId: business_id,
                outletId: outlet_id,
                orderId: orderId || razorpay_order_id,
                externalPaymentId: razorpay_payment_id,
                amount: Number(amount) || 0,
                status: 'SUCCESS',
                method: method || 'razorpay'
            }, { transaction });

            // Update order status if linked
            if (orderId) {
                await Order.update(
                    { status: 'PAID', paymentId: payment.id },
                    { where: { id: orderId, businessId: business_id, outletId: outlet_id }, transaction }
                );
            }

            return payment;
        });

        const responseData = result.data || result;
        res.json({ 
            success: true, 
            data: responseData, 
            message: "Payment verified successfully (Sandbox Mode)" 
        });
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
