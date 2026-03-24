/**
 * SUPPLIER ROUTES
 * Maps to frontend API calls from Suppliers.jsx
 */

const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');

// GET /api/tenant/inventory/suppliers
router.get('/suppliers', supplierController.getSuppliers);

// POST /api/tenant/inventory/suppliers
router.post('/suppliers', supplierController.createSupplier);

// PUT /api/tenant/inventory/suppliers/:id
router.put('/suppliers/:id', supplierController.updateSupplier);

// DELETE /api/tenant/inventory/suppliers/:id
router.delete('/suppliers/:id', supplierController.deleteSupplier);

module.exports = router;
