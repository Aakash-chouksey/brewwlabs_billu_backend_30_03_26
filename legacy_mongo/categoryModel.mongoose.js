const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business' }, // Optional for Global Menus
    name: { type: String, required: true },
    description: { type: String },
    isGlobal: { type: Boolean, default: false }
}, { timestamps: true });

categorySchema.index({ businessId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Category", categorySchema);
