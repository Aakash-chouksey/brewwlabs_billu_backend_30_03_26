const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    notes: { type: String }
});

const orderSchema = new mongoose.Schema({
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
    outletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Outlet', required: true },
    
    customerDetails: {
        name: { type: String, required: true },
        phone: { type: String, required: true },
        guests: { type: Number, required: true },
    },

    orderStatus: {
        type: String,
        enum: ['CREATED', 'KOT_SENT', 'PREPARING', 'READY', 'SERVED', 'CLOSED', 'CANCELLED'],
        default: 'CREATED'
    },

    billing: {
        subTotal: { type: Number, required: true },
        tax: { type: Number, required: true },
        discount: { type: Number, default: 0 },
        total: { type: Number, required: true }
    },

    items: [orderItemSchema],
    
    table: { type: mongoose.Schema.Types.ObjectId, ref: "Table" },
    
    payment: {
        method: { type: String, enum: ['Cash', 'Online', 'Card', 'Due', 'Other', 'Part', 'Pending'], default: 'Pending' },
        status: { type: String, enum: ['Pending', 'Completed', 'Failed'], default: 'Pending' },
        razorpay_order_id: String,
        razorpay_payment_id: String,
        paidAt: Date
    },

    idempotencyKey: { type: String, unique: true }, // To prevent duplicate orders
    waiterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }

}, { timestamps: true });

// Ensure businessId is indexed for fast multi-tenant queries
orderSchema.index({ businessId: 1, outletId: 1 });
orderSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Order", orderSchema);