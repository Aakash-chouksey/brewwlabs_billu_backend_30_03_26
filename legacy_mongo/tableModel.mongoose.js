const mongoose = require("mongoose");

const tableSchema = new mongoose.Schema({
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
    outletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Outlet', required: true },
    
    tableNo: { type: String, required: true }, // Changed to String to support 'A1', 'T1' etc.
    area: { type: String, default: "Main Area" }, // e.g., Rooftop, Indoor, Outdoor
    status: {
        type: String,
        enum: ['Available', 'Occupied', 'Reserved'],
        default: "Available"
    },
    seats: { 
        type: Number,
        required: true
    },
    currentOrder: { type: mongoose.Schema.Types.ObjectId, ref: "Order" }
}, { timestamps: true });

// Table number is unique within an outlet
tableSchema.index({ outletId: 1, tableNo: 1 }, { unique: true });

module.exports = mongoose.model("Table", tableSchema);