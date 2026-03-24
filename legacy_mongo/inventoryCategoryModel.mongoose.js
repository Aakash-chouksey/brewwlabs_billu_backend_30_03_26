const mongoose = require("mongoose");

const inventoryCategorySchema = new mongoose.Schema({
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
    name: { type: String, required: true },
    description: { type: String }
}, { timestamps: true });

inventoryCategorySchema.index({ businessId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("InventoryCategory", inventoryCategorySchema);
