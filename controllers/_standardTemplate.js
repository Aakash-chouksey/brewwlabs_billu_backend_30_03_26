/**
 * STANDARD CONTROLLER TEMPLATE
 * 
 * PHASE 7: ALL controllers MUST follow this exact pattern
 * 
 * Rules:
 * 1. Use req.readWithTenant for GET APIs (non-transactional reads)
 * 2. Use req.executeWithTenant for POST/PUT/DELETE (transactional writes)
 * 3. Always return via res.sendSuccess() or res.sendError()
 * 4. Always use safe.* helpers for null safety
 * 5. Never modify global state
 * 6. Never use direct model access outside executor
 */

const { safeArray, safeObject, safeNumber } = require('../utils/safeDb');

/**
 * Example: GET API (Read Operation)
 */
exports.getExample = async (req, res, next) => {
  try {
    // Use readWithTenant for GET operations (no transaction overhead)
    const result = await req.readWithTenant(async (context) => {
      const { transactionModels: models } = context;
      const { Product, Category } = models;
      
      const products = await Product.findAll({
        where: { businessId: req.businessId },
        include: [{ model: Category }]
      });
      
      // Always return safe arrays
      return {
        products: safeArray(products)
      };
    });
    
    // Use standardized response
    return res.sendSuccess(result, 'Products retrieved successfully');
    
  } catch (error) {
    next(error);
  }
};

/**
 * Example: POST API (Write Operation)
 */
exports.createExample = async (req, res, next) => {
  try {
    const { name, price } = req.body;
    
    // Validation
    if (!name) {
      return res.sendError('Name is required', {}, 400);
    }
    
    // Use executeWithTenant for writes (transactional)
    const result = await req.executeWithTenant(async (context) => {
      const { transaction, transactionModels: models } = context;
      const { Product } = models;
      
      const product = await Product.create({
        businessId: req.businessId,
        name,
        price: safeNumber(price)
      }, { transaction });
      
      return safeObject(product);
    });
    
    return res.sendSuccess(result, 'Product created successfully', 201);
    
  } catch (error) {
    next(error);
  }
};

/**
 * Example: PUT API (Update Operation)
 */
exports.updateExample = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const result = await req.executeWithTenant(async (context) => {
      const { transaction, transactionModels: models } = context;
      const { Product } = models;
      
      const product = await Product.findOne({
        where: { id, businessId: req.businessId },
        transaction
      });
      
      if (!product) {
        throw new Error('Product not found');
      }
      
      await product.update(updateData, { transaction });
      return safeObject(product);
    });
    
    return res.sendSuccess(result, 'Product updated successfully');
    
  } catch (error) {
    next(error);
  }
};

/**
 * Example: DELETE API (Delete Operation)
 */
exports.deleteExample = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    await req.executeWithTenant(async (context) => {
      const { transaction, transactionModels: models } = context;
      const { Product } = models;
      
      const product = await Product.findOne({
        where: { id, businessId: req.businessId },
        transaction
      });
      
      if (!product) {
        throw new Error('Product not found');
      }
      
      await product.destroy({ transaction });
    });
    
    return res.sendSuccess({}, 'Product deleted successfully');
    
  } catch (error) {
    next(error);
  }
};

module.exports = {
  // Export examples as reference
};
