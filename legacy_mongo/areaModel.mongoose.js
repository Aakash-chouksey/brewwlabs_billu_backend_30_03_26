const mongoose = require("mongoose");

const areaSchema = new mongoose.Schema({
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
    outletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Outlet', required: true },
    name: { type: String, required: true }, // e.g. Rooftop, Main Hall, Garden
}, { timestamps: true });

areaSchema.index({ outletId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Area", areaSchema);
