const { Op } = require('sequelize');
const { assertTransaction, assertTenant } = require('../../src/utils/guards');

/**
 * Inventory Repository - DATA-FIRST REFACTORED
 */
const inventoryRepository = {
    /**
     * Find all inventory items with associations
     */
    findAll: async ({ models, transaction, businessId, outletId, filters = {} }) => {
        assertTransaction(transaction);
        assertTenant(businessId);

        const { Inventory, Product, Category } = models;
        const { categoryId, search } = filters;

        const whereClause = { businessId };
        if (outletId) whereClause.outletId = outletId;

        const include = [
            {
                model: Product,
                include: [{
                    model: Category,
                    where: categoryId ? { id: categoryId } : undefined,
                    required: !!categoryId
                }]
            }
        ];

        if (search) {
            include[0].where = {
                [Op.or]: [
                    { name: { [Op.iLike]: `%${search}%` } },
                    { sku: { [Op.iLike]: `%${search}%` } }
                ]
            };
        }

        return await Inventory.findAll({
            where: whereClause,
            include,
            transaction
        });
    },

    /**
     * Find or create an inventory record for a product
     */
    findOrCreate: async ({ models, transaction, businessId, outletId, productId, defaults }) => {
        assertTransaction(transaction);
        assertTenant(businessId);

        const { Inventory } = models;
        return await Inventory.findOrCreate({
            where: { businessId, outletId, productId },
            defaults,
            transaction
        });
    }
};

module.exports = inventoryRepository;
