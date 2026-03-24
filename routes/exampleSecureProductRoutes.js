const express = require('express');
const router = express.Router();

// Import security middleware
const { authorize, requireTenantFilter } = require('../middlewares/tenantMiddleware');
const { tenantRateLimit } = require('../middlewares/tenantRateLimitMiddleware');
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const { tenantRoutingMiddleware } = require("../middlewares/tenantRouting");
const { setTenantContextMiddleware } = require("../src/db/getModelsForRequest");

// Import controllers
const productController = require('../controllers/productController');

// Apply authentication first
router.use(isVerifiedUser);

// Apply tenant routing for non-SuperAdmin routes
router.use((req, res, next) => {
    if (req.user.role === 'SuperAdmin') {
        return next();
    }
    return tenantRoutingMiddleware(req, res, next);
});

// Apply tenant context
router.use(setTenantContextMiddleware);

// Apply rate limiting
router.use(tenantRateLimit);

// Product routes with comprehensive security

// GET /api/products - Get products with tenant filtering
// Rate limit: Standard API rate limit per tenant
router.get('/', 
    tenantRateLimit('api'),
    requireTenantFilter, // Enforce tenant filtering at query level
    productController.getProducts
);

// POST /api/products - Create new product
// Rate limit: Strict rate limit for creation operations
// Authorization: Only BusinessAdmin, Manager, and above can create products
router.post('/', 
    tenantRateLimit('strict'),
    authorize(['BusinessAdmin', 'Manager', 'SubAdmin']),
    productController.addProduct
);

// GET /api/products/:id - Get specific product
// Rate limit: Standard API rate limit per tenant
router.get('/:id', 
    tenantRateLimit('api'),
    requireTenantFilter,
    productController.getProduct // This would need to be implemented
);

// PUT /api/products/:id - Update product
// Rate limit: Strict rate limit for update operations
// Authorization: Only BusinessAdmin, Manager, and above can update products
router.put('/:id', 
    tenantRateLimit('strict'),
    authorize(['BusinessAdmin', 'Manager', 'SubAdmin']),
    productController.updateProduct
);

// DELETE /api/products/:id - Delete product
// Rate limit: Strict rate limit for delete operations
// Authorization: Only BusinessAdmin and Manager can delete products
router.delete('/:id', 
    tenantRateLimit('strict'),
    authorize(['BusinessAdmin', 'Manager']),
    productController.deleteProduct
);

module.exports = router;
