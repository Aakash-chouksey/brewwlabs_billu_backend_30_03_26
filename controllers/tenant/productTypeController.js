/**
 * NEON-SAFE ARCHITECTURE COMPLIANCE
 * 
 * This controller follows the standardized high-performance architecture:
 * - All DB calls MUST use req.readWithTenant() or req.executeWithTenant() via service.
 */

const productTypeService = require("../../services/tenant/productType.service");
const cache = require("../../utils/cache");

const createProductType = async (req, res, next) => {
    try {
        const productType = await productTypeService.createProductType(req, req.body);
        
        // Invalidate cache
        const cacheKey = cache.generateKey(req, 'product-types');
        await cache.del(cacheKey);
        
        // Also invalidate related caches
        const productsCacheKey = cache.generateKey(req, 'products');
        await cache.del(`${productsCacheKey}:all`);
        const categoriesCacheKey = cache.generateKey(req, 'categories');
        await cache.del(categoriesCacheKey);

        res.status(201).json({ 
            success: true, 
            data: productType,
            message: "Product type created successfully"
        });
    } catch (error) {
        next(error);
    }
};

const getProductTypes = async (req, res, next) => {
    try {
        // Try cache first
        const cacheKey = cache.generateKey(req, 'product-types');
        const cachedProductTypes = await cache.get(cacheKey);
        
        if (cachedProductTypes) {
            return res.status(200).json({ 
                success: true, 
                data: cachedProductTypes, 
                message: "Product types retrieved from cache",
                _cached: true 
            });
        }

        const productTypes = await productTypeService.getProductTypes(req);
        
        // Store in cache for 10 minutes
        await cache.set(cacheKey, productTypes, 600);
        
        res.status(200).json({ 
            success: true, 
            data: productTypes,
            message: "Product types retrieved successfully"
        });
    } catch (error) {
        next(error);
    }
};

const updateProductType = async (req, res, next) => {
    try {
        const { id } = req.params;
        const productType = await productTypeService.updateProductType(req, id, req.body);
        
        // Invalidate cache
        const cacheKey = cache.generateKey(req, 'product-types');
        await cache.del(cacheKey);
        
        // Also invalidate related caches
        const productsCacheKey = cache.generateKey(req, 'products');
        await cache.del(`${productsCacheKey}:all`);
        const categoriesCacheKey = cache.generateKey(req, 'categories');
        await cache.del(categoriesCacheKey);
        
        res.status(200).json({ 
            success: true, 
            data: productType,
            message: "Product type updated successfully"
        });
    } catch (error) {
        next(error);
    }
};

const deleteProductType = async (req, res, next) => {
    try {
        const { id } = req.params;
        await productTypeService.deleteProductType(req, id);
        
        // Invalidate cache
        const cacheKey = cache.generateKey(req, 'product-types');
        await cache.del(cacheKey);
        
        // Also invalidate related caches
        const productsCacheKey = cache.generateKey(req, 'products');
        await cache.del(`${productsCacheKey}:all`);
        const categoriesCacheKey = cache.generateKey(req, 'categories');
        await cache.del(categoriesCacheKey);
        
        res.status(200).json({ 
            success: true, 
            message: "Product type deleted successfully" 
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createProductType,
    getProductTypes,
    updateProductType,
    deleteProductType
};
