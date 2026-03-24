const express = require('express');
const router = express.Router();
const { isVerifiedUser, tenantOnlyMiddleware } = require('../middlewares/tokenVerification');
const {
    getSuppliers,
    addSupplier,
    updateSupplier,
    deleteSupplier
} = require('../controllers/supplierController');

// Apply authentication middleware
router.use(isVerifiedUser);
router.use(tenantOnlyMiddleware);

// Supplier Routes
router.get('/suppliers', getSuppliers);
router.post('/suppliers', addSupplier);
router.put('/suppliers/:id', updateSupplier);
router.delete('/suppliers/:id', deleteSupplier);

module.exports = router;
