const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    
    name: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true },
    image: { type: String },
    productType: { type: String, enum: ['Veg', 'Non-Veg', 'Egg'], default: 'Veg' },
    
    isAvailable: { type: Boolean, default: true },
    stock: { type: Number, default: 0 },
    trackStock: { type: Boolean, default: false },
    
    // Inventory/Recipe link (Optional for simple POS)
    recipe: [{
        ingredientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory' },
        quantity: { type: Number }
    }]
}, { timestamps: true });

productSchema.index({ businessId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Product", productSchema);
