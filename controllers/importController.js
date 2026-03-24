/**
 * NEON-SAFE ARCHITECTURE COMPLIANCE
 * 
 * This controller follows the standardized high-performance architecture:
 * - Models accessed via context.models (READ) or context.transactionModels (WRITE)
 * - req.models is DEPRECATED and blocked by middleware to prevent connection pinning.
 * - All DB calls MUST use req.readWithTenant() or req.executeWithTenant().
 */

const importService = require('../services/importService');
const fs = require('fs');

const importController = {
  importProducts: async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ status: 'fail', message: 'No file uploaded' });
      }

      const filePath = req.file.path;
      const rawData = await importService.parseCSV(filePath);
      
      // Cleanup file
      fs.unlinkSync(filePath);

      const validData = importService.validateProductData(rawData);
      
      if (validData.length === 0) {
        return res.status(400).json({ status: 'fail', message: 'No valid data found in CSV' });
      }

      const businessId = req.user.businessId;
      const result = await importService.importProducts(validData, businessId);

      res.status(200).json({
        status: 'success',
        count: result.length,
        message: 'Products imported successfully'
      });
    } catch (error) {
      next(error);
    }
  },

  importInventory: async (req, res, next) => {
      try {
        if (!req.file) {
            return res.status(400).json({ status: 'fail', message: 'No file uploaded' });
        }
        
        const filePath = req.file.path;
        const rawData = await importService.parseCSV(filePath);
        fs.unlinkSync(filePath);
        
        const businessId = req.user.businessId;
        const outletId = req.body.outletId; // Must be provided
        
        if (!outletId) {
             return res.status(400).json({ status: 'fail', message: 'Outlet ID required' });
        }

        const result = await importService.importInventory(rawData, businessId, outletId);

        res.status(200).json({
            status: 'success',
            count: result.length,
            message: 'Inventory imported successfully'
        });
      } catch (error) {
          next(error);
      }
  },

  importCategories: async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ status: 'fail', message: 'No file uploaded' });
      }

      const filePath = req.file.path;
      const rawData = await importService.parseCSV(filePath);
      
      // Cleanup file
      fs.unlinkSync(filePath);

      const validData = importService.validateCategoryData(rawData);
      
      if (validData.length === 0) {
        return res.status(400).json({ status: 'fail', message: 'No valid data found in CSV' });
      }

      const businessId = req.user.businessId;
      const result = await importService.importCategories(validData, businessId);

      res.status(200).json({
        status: 'success',
        count: result.length,
        message: 'Categories imported successfully'
      });
    } catch (error) {
      next(error);
    }
  },

  getImportStatus: async (req, res, next) => {
    try {
      const status = {
        service: 'Import Service',
        available: true,
        supportedFormats: ['csv'],
        timestamp: new Date().toISOString()
      };

      res.status(200).json({
        status: 'success',
        data: status
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = importController;
