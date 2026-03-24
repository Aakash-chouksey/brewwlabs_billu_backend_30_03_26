const mongoose = require("mongoose");

const businessSchema = new mongoose.Schema({
    name: { type: String, required: true },
    address: { type: String },
    phone: { type: String },
    email: { type: String },
    gstNumber: { type: String },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { 
        type: String, 
        enum: ['active', 'inactive', 'suspended', 'trial', 'pending', 'rejected'], 
        default: 'pending' // Default to pending for approval workflow
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    rejectionReason: { type: String },
    subscription: {
        plan: { 
            type: String, 
            enum: ['free', 'basic', 'pro', 'enterprise'], 
            default: 'free' 
        },
        expiresAt: { type: Date },
        outletsLimit: { type: Number, default: 1 },
        staffLimit: { type: Number, default: 5 },
        isTrial: { type: Boolean, default: true }
    },
    assignedCategories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }]
}, { timestamps: true });

module.exports = mongoose.model("Business", businessSchema);
