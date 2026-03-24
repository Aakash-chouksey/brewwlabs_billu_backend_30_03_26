/**
 * Supplier Controller - Neon-Safe Version
 * Standardized for transaction-scoped model access
 */

const { v4: uuidv4 } = require('uuid');
const createHttpError = require('http-errors');

const supplierController = {
    /**
     * Get all suppliers
     */
    getSuppliers: async (req, res, next) => {
        try {
            const { businessId } = req;

            const suppliers = await req.readWithTenant(async (context) => {
                const { transactionModels: models } = context;
                const { Supplier } = models;

                return await Supplier.findAll({
                    where: { businessId },
                    order: [['name', 'ASC']]
                });
            });

            res.json({
                success: true,
                data: suppliers
            });

        } catch (error) {
            next(error);
        }
    },

    /**
     * Add supplier
     */
    addSupplier: async (req, res, next) => {
        try {
            const { businessId } = req;
            const { name, contactPerson, email, phone, address, gstNumber, paymentTerms } = req.body;

            const supplier = await req.executeWithTenant(async (context) => {
                const { transaction, transactionModels: models } = context;
                const { Supplier } = models;

                // Check if supplier with email already exists within this business
                if (email) {
                    const existing = await Supplier.findOne({
                        where: { email, businessId },
                        transaction
                    });
                    if (existing) {
                        throw createHttpError(409, 'Supplier with this email already exists');
                    }
                }

                return await Supplier.create({
                    id: uuidv4(),
                    businessId,
                    name,
                    contactPerson,
                    email,
                    phone,
                    address,
                    gstNumber,
                    paymentTerms,
                    isActive: true
                }, { transaction });
            });

            res.status(201).json({
                success: true,
                message: 'Supplier created successfully',
                data: supplier
            });

        } catch (error) {
            next(error);
        }
    },

    /**
     * Update supplier
     */
    updateSupplier: async (req, res, next) => {
        try {
            const { id } = req.params;
            const { businessId } = req;
            const { name, contactPerson, email, phone, address, gstNumber, paymentTerms, isActive } = req.body;

            const updated = await req.executeWithTenant(async (context) => {
                const { transaction, transactionModels: models } = context;
                const { Supplier } = models;

                const supplier = await Supplier.findOne({
                    where: { id, businessId },
                    transaction
                });

                if (!supplier) {
                    throw createHttpError(404, 'Supplier not found');
                }

                const updateData = {};
                if (name !== undefined) updateData.name = name;
                if (contactPerson !== undefined) updateData.contactPerson = contactPerson;
                if (email !== undefined) updateData.email = email;
                if (phone !== undefined) updateData.phone = phone;
                if (address !== undefined) updateData.address = address;
                if (gstNumber !== undefined) updateData.gstNumber = gstNumber;
                if (paymentTerms !== undefined) updateData.paymentTerms = paymentTerms;
                if (isActive !== undefined) updateData.isActive = isActive;

                return await supplier.update(updateData, { transaction });
            });

            res.json({
                success: true,
                message: 'Supplier updated successfully',
                data: updated
            });

        } catch (error) {
            next(error);
        }
    },

    /**
     * Delete supplier
     */
    deleteSupplier: async (req, res, next) => {
        try {
            const { id } = req.params;
            const { businessId } = req;

            await req.executeWithTenant(async (context) => {
                const { transaction, transactionModels: models } = context;
                const { Supplier } = models;

                const supplier = await Supplier.findOne({
                    where: { id, businessId },
                    transaction
                });

                if (!supplier) {
                    throw createHttpError(404, 'Supplier not found');
                }

                await supplier.destroy({ transaction });
            });

            res.json({
                success: true,
                message: 'Supplier deleted successfully'
            });

        } catch (error) {
            next(error);
        }
    }
};

module.exports = supplierController;
