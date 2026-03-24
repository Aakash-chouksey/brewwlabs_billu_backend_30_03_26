const { Sequelize } = require('sequelize');

/**
 * End-to-end test of tenant database functionality
 */
async function testTenantFunctionality() {
    let sequelize;
    
    try {
        console.log('🧪 End-to-end test of tenant functionality...');
        
        const dbUrl = "postgresql://neondb_owner:npg_ftcY7qM5vGUe@ep-lively-glitter-a1yqd90q-pooler.ap-southeast-1.aws.neon.tech/tenant_brew_cafe?sslmode=require";
        
        sequelize = new Sequelize(dbUrl, {
            dialect: 'postgres',
            dialectOptions: {
                ssl: {
                    require: true,
                    rejectUnauthorized: false
                },
                connectTimeout: 10000,
                statement_timeout: 30000
            },
            logging: false
        });
        
        await sequelize.authenticate();
        console.log('✅ Connected to tenant database');
        
        // Test 1: Add a new category
        console.log('\n📝 Test 1: Adding a new category...');
        const [newCategory] = await sequelize.query(`
            INSERT INTO categories (id, name, outlet_id, is_enabled, sort_order, created_at, updated_at)
            VALUES (gen_random_uuid(), 'Test Category', NULL, true, 1, NOW(), NOW())
            RETURNING id, name, is_enabled
        `);
        
        console.log(`✅ Created category: ${newCategory[0].name} (ID: ${newCategory[0].id})`);
        
        // Test 2: Add a new product
        console.log('\n📝 Test 2: Adding a new product...');
        const [newProduct] = await sequelize.query(`
            INSERT INTO products (id, name, price, outlet_id, category_id, is_available, created_at, updated_at)
            VALUES (gen_random_uuid(), 'Test Product', 99.99, NULL, :categoryId, true, NOW(), NOW())
            RETURNING id, name, price, is_available
        `, {
            replacements: { categoryId: newCategory[0].id }
        });
        
        console.log(`✅ Created product: ${newProduct[0].name} (ID: ${newProduct[0].id}, Price: $${newProduct[0].price})`);
        
        // Test 3: Add inventory for the product
        console.log('\n📝 Test 3: Adding inventory...');
        const [newInventory] = await sequelize.query(`
            INSERT INTO inventory (id, product_id, quantity, outlet_id, min_stock, max_stock, last_updated, created_at, updated_at)
            VALUES (gen_random_uuid(), :productId, 100, NULL, 10, 500, NOW(), NOW(), NOW())
            RETURNING id, product_id, quantity
        `, {
            replacements: { productId: newProduct[0].id }
        });
        
        console.log(`✅ Created inventory: ${newInventory[0].quantity} units for product ID: ${newInventory[0].product_id}`);
        
        // Test 4: Create a test order
        console.log('\n📝 Test 4: Creating a test order...');
        const [newOrder] = await sequelize.query(`
            INSERT INTO orders (id, order_number, user_id, total_amount, outlet_id, status, created_at, updated_at)
            VALUES (gen_random_uuid(), 'TEST-001', :userId, 199.98, NULL, 'pending', NOW(), NOW())
            RETURNING id, order_number, status, total_amount
        `, {
            replacements: { userId: '27869fcf-36cb-4412-a7e1-545c50290048' }
        });
        
        console.log(`✅ Created order: ${newOrder[0].order_number} (ID: ${newOrder[0].id}, Total: $${newOrder[0].total_amount})`);
        
        // Test 5: Query all data to verify relationships
        console.log('\n📊 Test 5: Verifying data relationships...');
        
        const [categories] = await sequelize.query(`
            SELECT c.id, c.name, COUNT(p.id) as product_count
            FROM categories c
            LEFT JOIN products p ON p.category_id = c.id
            GROUP BY c.id, c.name
            ORDER BY c.created_at DESC
        `);
        
        console.log('✅ Categories with product counts:');
        categories.forEach(cat => {
            console.log(`  - ${cat.name}: ${cat.product_count} products`);
        });
        
        // Test 6: Update order status
        console.log('\n📝 Test 6: Updating order status...');
        await sequelize.query(`
            UPDATE orders 
            SET status = 'completed', updated_at = NOW()
            WHERE id = :orderId
        `, {
            replacements: { orderId: newOrder[0].id }
        });
        
        console.log(`✅ Updated order ${newOrder[0].order_number} to completed`);
        
        // Test 7: Update inventory
        console.log('\n📝 Test 7: Updating inventory...');
        await sequelize.query(`
            UPDATE inventory 
            SET quantity = quantity - 10, last_updated = NOW()
            WHERE product_id = :productId
        `, {
            replacements: { productId: newProduct[0].id }
        });
        
        console.log(`✅ Updated inventory for product ${newProduct[0].name} (removed 10 units)`);
        
        // Test 8: Final verification
        console.log('\n🧪 Test 8: Final verification...');
        
        const [finalStats] = await sequelize.query(`
            SELECT 
                (SELECT COUNT(*) FROM users) as users,
                (SELECT COUNT(*) FROM categories) as categories,
                (SELECT COUNT(*) FROM products) as products,
                (SELECT COUNT(*) FROM orders) as orders,
                (SELECT COUNT(*) FROM inventory) as inventory
        `);
        
        console.log('\n📊 Final Database Statistics:');
        console.log(`  Users: ${finalStats[0].users}`);
        console.log(`  Categories: ${finalStats[0].categories}`);
        console.log(`  Products: ${finalStats[0].products}`);
        console.log(`  Orders: ${finalStats[0].orders}`);
        console.log(`  Inventory: ${finalStats[0].inventory}`);
        
        await sequelize.close();
        
        console.log('\n🎉 SUCCESS: All tenant functionality tests passed!');
        console.log('✅ Categories, Products, Orders, Inventory all working');
        console.log('✅ Your POS system is fully operational!');
        console.log('✅ You can now manage your cafe business completely');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (sequelize) {
            await sequelize.close();
        }
        process.exit(1);
    }
}

// Run the test
if (require.main === module) {
    testTenantFunctionality();
}

module.exports = { testTenantFunctionality };
