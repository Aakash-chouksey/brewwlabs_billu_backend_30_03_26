const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema({
    name : {
        type: String,
        required: true,
    },

    phone: {
        type: String,
        required: function() { return !this.email; }, // Phone required if no email
        unique: true,
        sparse: true // Allow unique index to ignore nulls
    },

    email: {
        type: String,
        required: function() { return !this.phone; }, // Email required if no phone
        unique: true,
        sparse: true
    },

    profileImageUrl: {
        type: String,
        default: ""
    },

    password: {
        type: String, // For SuperAdmin / Dashboard login
        select: false
    },

    otp: {
        code: { type: String },
        expiresAt: { type: Date }
    },

    businessId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Business'
    },

    outletIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Outlet'
    }],

    role: {
        type: String,
        enum: ['SuperAdmin', 'BusinessAdmin', 'SubAdmin', 'Manager', 'Cashier', 'Waiter'],
        default: 'Waiter'
    },

    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    assignedCategories: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category'
    }],
    permissions: [{
        menu: { type: String },
        subMenus: [{ type: String }]
    }],
    tokenVersion: {
        type: Number,
        default: 0
    }
}, { timestamps : true })



module.exports = mongoose.model("User", userSchema);