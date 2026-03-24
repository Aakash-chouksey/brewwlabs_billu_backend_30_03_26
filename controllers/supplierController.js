/**
 * SUPPLIER CONTROLLER - Neon-Safe Transaction Pattern
 * Matches frontend API calls from Suppliers.jsx
 */

const createHttpError = require("http-errors");
const { Op } = require("sequelize");

/**
 * Get all suppliers
 * GET /api/tenant/inventory/suppliers
 */
exports.getSuppliers = async (req, res, next) => {
    try {
        const { businessId } = req;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { Supplier } = models;
            
            return await Supplier.findAll({
                where: { businessId },
                order: [['name', 'ASC']]
            });
        });

        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};

/**
 * Create supplier
 * POST /api/tenant/inventory/suppliers
 */
exports.createSupplier = async (req, res, next) => {
    try {
        const { businessId } = req;
        const { name, contactPerson, email, phone, address, gstNumber, paymentTerms } = req.body;

        if (!name) {
            throw createHttpError(400, "Supplier name is required");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Supplier } = models;
            
            return await Supplier.create({
                businessId,
                name,
                contactPerson,
                email,
                phone,
                address,
                gstNumber,
                paymentTerms: paymentTerms || 'NET_30',
                isActive: true
            }, { transaction });
        });

        res.status(201).json({ success: true, data: result, message: "Supplier created" });
    } catch (error) {
        next(error);
    }
};

/**
 * Update supplier
 * PUT /api/tenant/inventory/suppliers/:id
 */
exports.updateSupplier = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { businessId } = req;
        const updateData = req.body;

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Supplier } = models;
            
            const supplier = await Supplier.findOne({
                where: { id, businessId },
                transaction
            });
            if (!supplier) throw createHttpError(404, "Supplier not found");

            await supplier.update(updateData, { transaction });
            return supplier;
        });

        res.json({ success: true, data: result, message: "Supplier updated" });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete supplier
 * DELETE /api/tenant/inventory/suppliers/:id
 */
exports.deleteSupplier = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { businessId } = req;

        await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Supplier, Purchase } = models;
            
            // Check if supplier has purchases
            const purchases = await Purchase.count({
                where: { supplierId: id },
                transaction
            });
            if (purchases > 0) {
                throw createHttpError(400, `Cannot delete supplier with ${purchases} purchases`);
            }

            const supplier = await Supplier.findOne({
                where: { id, businessId },
                transaction
            });
            if (!supplier) throw createHttpError(404, "Supplier not found");

            await supplier.destroy({ transaction });
        });

        res.json({ success: true, message: "Supplier deleted" });
    } catch (error) {
        next(error);
    }
};
