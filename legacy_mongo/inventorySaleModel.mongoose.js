const mongoose = require("mongoose");

const inventorySaleSchema = new mongoose.Schema({
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
    outletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Outlet', required: true },
    
    inventoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', required: true },
    quantity: { type: Number, required: true },
    reason: { type: String, enum: ['Direct Sale', 'Wastage', 'Self Consumption'], default: 'Direct Sale' },
    
    saleDate: { type: Date, default: Date.now },
    notes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model("InventorySale", inventorySaleSchema);
