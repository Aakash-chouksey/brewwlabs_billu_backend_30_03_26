const request = require('supertest');
const app = require('../../app');
const { sequelize } = require('../../config/database_postgres');
const InventoryItem = require('../../models/inventoryItemModel');
const Recipe = require('../../models/recipeModel');
const RecipeItem = require('../../models/recipeItemModel');
const Product = require('../../models/productModel');
const Category = require('../../models/categoryModel');

const InventoryCategory = require('../../models/inventoryCategoryModel');

describe('Recipe-based Inventory Deduction Integration', () => {
    let brandId, outletId, authToken;

    beforeAll(async () => {
        // Mock tenant data
        brandId = 'test-brand-id';
        outletId = 'test-outlet-id';
        authToken = 'test-token';
    });

    test('Should deduct inventory when order is placed for a product with a recipe', async () => {
        // 0. Create Category
        const invCat = await InventoryCategory.create({
            name: 'Beans',
            brandId,
            outletId
        });

        // 1. Create Inventory Item
        const item = await InventoryItem.create({
            name: 'Coffee Beans',
            unit: 'kg',
            currentStock: 10,
            minimumStock: 1,
            inventoryCategoryId: invCat.id,
            brandId,
            outletId
        });

        // 2. Create Category and Product
        const category = await Category.create({ name: 'Hot Coffee', brandId });
        const product = await Product.create({
            name: 'Espresso',
            price: 50,
            categoryId: category.id,
            brandId
        });

        // 3. Create Recipe
        const recipe = await Recipe.create({
            productId: product.id,
            name: 'Standard Espresso',
            brandId,
            outletId
        });

        await RecipeItem.create({
            recipeId: recipe.id,
            inventoryItemId: item.id,
            quantityRequired: 0.1, // 100g
            unit: 'kg',
            brandId,
            outletId
        });

        // 4. Place Order
        const orderData = {
            tableId: 'some-table-id',
            items: [
                { productId: product.id, quantity: 2, price: 50 }
            ],
            orderStatus: 'CREATED'
        };

        const res = await request(app)
            .post('/api/tenant/orders')
            .set('Authorization', `Bearer ${authToken}`)
            .set('x-brand-id', brandId)
            .set('x-outlet-id', outletId)
            .set('x-panel-type', 'TENANT')
            .send(orderData);

        expect(res.status).toBe(201);

        // 5. Verify Stock Deduction
        const updatedItem = await InventoryItem.findByPk(item.id);
        // Previous stock was 10. Required: 0.1 * 2 = 0.2. New stock: 9.8
        expect(Number(updatedItem.currentStock)).toBe(9.8);
    });

    test('Should reject order if inventory is insufficient', async () => {
        // ... (Similar setup with low stock)
    });
});
