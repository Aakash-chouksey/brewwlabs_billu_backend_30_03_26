const mongoose = require("mongoose");

const outletSchema = new mongoose.Schema({
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
    name: { type: String, required: true },
    profileImageUrl: { type: String, default: "" },
    address: { type: String },
    contactNumber: { type: String },
    timings: {
        open: { type: String, default: "09:00 AM" },
        close: { type: String, default: "11:00 PM" }
    },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model("Outlet", outletSchema);
