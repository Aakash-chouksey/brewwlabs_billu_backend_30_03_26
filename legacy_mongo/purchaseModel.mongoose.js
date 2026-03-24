const mongoose = require("mongoose");

const purchaseSchema = new mongoose.Schema({
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
    outletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Outlet', required: true },
    
    inventoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', required: true },
    quantity: { type: Number, required: true },
    pricePerUnit: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    
    supplier: { type: String },
    purchaseDate: { type: Date, default: Date.now },
    billNumber: { type: String },
    paymentStatus: { type: String, enum: ['Paid', 'Pending', 'Partial'], default: 'Paid' }
}, { timestamps: true });

module.exports = mongoose.model("Purchase", purchaseSchema);
