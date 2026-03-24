/**
 * PRODUCT TYPE ROUTES
 * Maps to frontend API calls from ProductTypes.jsx
 */

const express = require('express');
const router = express.Router();
const productTypeController = require('../controllers/productTypeController');

// GET /api/tenant/product-types
router.get('/product-types', productTypeController.getProductTypes);

// POST /api/tenant/product-types
router.post('/product-types', productTypeController.createProductType);

// PUT /api/tenant/product-types/:id
router.put('/product-types/:id', productTypeController.updateProductType);

// DELETE /api/tenant/product-types/:id
router.delete('/product-types/:id', productTypeController.deleteProductType);

module.exports = router;
