#!/usr/bin/env node

/**
 * CREATE COMPLETE DEMO DATA
 * This script creates a fully functional demo account with:
 * - Business, Brand, Outlet, Admin User
 * - Tables with areas
 * - Complete menu with categories and products (with images)
 * - Sample orders and sales data
 * - Inventory items
 * - Customer data
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const path = require('path');
const { controlPlaneSequelize } = require(path.join(process.cwd(), 'config', 'control_plane_db'));
const { v4: uuidv4 } = require('uuid');

// Import control plane models
const { Business, SuperAdminUser, TenantConnection } = require(path.join(process.cwd(), 'control_plane_models'));

// Import tenant models
const getUserModel = require(path.join(process.cwd(), 'models', 'userModel'));
const getOutletModel = require(path.join(process.cwd(), 'models', 'outletModel'));
const getAreaModel = require(path.join(process.cwd(), 'models', 'areaModel'));
const getTableModel = require(path.join(process.cwd(), 'models', 'tableModel'));
const getCategoryModel = require(path.join(process.cwd(), 'models', 'categoryModel'));
const getProductModel = require(path.join(process.cwd(), 'models', 'productModel'));
const getOrderModel = require(path.join(process.cwd(), 'models', 'orderModel'));
const getOrderItemModel = require(path.join(process.cwd(), 'models', 'orderItemModel'));
const getCustomerModel = require(path.join(process.cwd(), 'models', 'customerModel'));
const getInventoryItemModel = require(path.join(process.cwd(), 'models', 'inventoryItemModel'));

// Helper function to get tenant connection
async function getTenantConnection(businessId) {
    const tenantConnectionFactory = require(path.join(process.cwd(), 'src', 'services', 'tenantConnectionFactory'));
    return await tenantConnectionFactory.getConnection(businessId);
}

async function createCompleteDemoData() {
    console.log('🏗️ Creating complete demo data...');
    
    try {
        // 1. Create Business in Control Plane
        console.log('📋 Creating business...');
        
        const timestamp = Date.now();
        const business = await Business.create({
            name: 'BrewLabs Cafe Complete Demo',
            email: `complete-demo-${timestamp}@brewwlabs.com`,
            phone: '15321157095',
            address: '123 Demo Street, Demo City, DC 12345',
            type: 'CAFE',
            status: 'active'
        });
        
        console.log(`✅ Business created: ${business.id}`);
        
        // 1.5. Create Tenant Connection
        console.log('🔗 Creating tenant connection...');
        await TenantConnection.create({
            dbName: 'brewlabs_dev',
            dbHost: 'localhost',
            dbPort: 5432,
            dbUser: 'brewlabs_user',
            encryptedPassword: 'securepass', // Plain text for demo (should be encrypted in production)
            businessId: business.id,
            poolMaxConnections: 10,
            poolMinConnections: 1,
            ssl: false,
            status: 'active'
        });
        
        console.log(`✅ Tenant connection created`);
        
        // 2. Get tenant connection
        const tenantSequelize = await getTenantConnection(business.id);
        
        // 2.5. Create all missing tables
        console.log('🏗️ Creating all missing tables...');
        const { execSync } = require('child_process');
        execSync(`node ${path.join(process.cwd(), 'scripts', 'create_all_tables.js')}`, { stdio: 'inherit' });
        
        console.log('✅ Tables created');
        
        // 3. Create Admin User
        console.log('👤 Creating admin user...');
        const User = getUserModel(tenantSequelize);
        const hashedPassword = await bcrypt.hash('DemoPassword123!', 10);
        
        const adminUser = await User.create({
            name: 'Complete Demo Admin',
            email: `complete-demo-${timestamp}@brewwlabs.com`,
            password: hashedPassword,
            role: 'ADMIN',
            businessId: business.id,
            brandId: uuidv4(), // Generate new brand ID since brand model doesn't exist
            isActive: true
        });
        
        console.log(`✅ Admin user created: ${adminUser.email}`);
        
        // 4. Create Outlet
        console.log('🏪 Creating outlet...');
        const Outlet = getOutletModel(tenantSequelize);
        
        const outlet = await Outlet.create({
            name: 'Main Branch',
            address: '123 Demo Street, Demo City, DC 12345',
            businessId: business.id,
            isHeadOffice: true
        });
        
        console.log(`✅ Outlet created: ${outlet.id}`);
        
        // 5. Create Areas
        console.log('📍 Creating areas...');
        const Area = getAreaModel(tenantSequelize);
        
        const areas = await Promise.all([
            Area.create({
                name: 'Indoor Seating',
                description: 'Comfortable indoor dining area',
                capacity: 40,
                layout: 'rectangular',
                businessId: business.id,
                outletId: outlet.id
            }),
            Area.create({
                name: 'Outdoor Patio',
                description: 'Al fresco dining area',
                capacity: 20,
                layout: 'square',
                businessId: business.id,
                outletId: outlet.id
            }),
            Area.create({
                name: 'Private Dining',
                description: 'Exclusive private dining space',
                capacity: 12,
                layout: 'circular',
                businessId: business.id,
                outletId: outlet.id
            })
        ]);
        
        console.log(`✅ Created ${areas.length} areas`);
        
        // 6. Create Tables
        console.log('🪑 Creating tables...');
        const Table = getTableModel(tenantSequelize);
        
        const tables = [];
        let tableCounter = 1;
        
        for (const area of areas) {
            const tableCount = area.name === 'Private Dining' ? 3 : 8;
            for (let i = 1; i <= tableCount; i++) {
                const table = await Table.create({
                    name: `${area.name.charAt(0)}${tableCounter++}`,
                    capacity: area.name === 'Private Dining' ? 4 : 4,
                    minCapacity: 2,
                    status: 'available',
                    businessId: business.id,
                    outletId: outlet.id,
                    areaId: area.id
                });
                tables.push(table);
            }
        }
        
        console.log(`✅ Created ${tables.length} tables`);
        
        // 7. Create Categories
        console.log('📂 Creating menu categories...');
        const Category = getCategoryModel(tenantSequelize);
        
        const categories = await Promise.all([
            Category.create({
                name: 'Coffee & Beverages',
                description: 'Fresh coffee and refreshing beverages',
                businessId: business.id,
                outletId: outlet.id,
                displayOrder: 1,
                imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=300&h=200&fit=crop'
            }),
            Category.create({
                name: 'Breakfast',
                description: 'Start your day right',
                businessId: business.id,
                outletId: outlet.id,
                displayOrder: 2,
                imageUrl: 'https://images.unsplash.com/photo-1535219245035-3c5af4a9c0a2?w=300&h=200&fit=crop'
            }),
            Category.create({
                name: 'Main Course',
                description: 'Hearty meals for lunch and dinner',
                businessId: business.id,
                outletId: outlet.id,
                displayOrder: 3,
                imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=300&h=200&fit=crop'
            }),
            Category.create({
                name: 'Desserts',
                description: 'Sweet treats to end your meal',
                businessId: business.id,
                outletId: outlet.id,
                displayOrder: 4,
                imageUrl: 'https://images.unsplash.com/photo-1551024506-0bcc7e28a6a5?w=300&h=200&fit=crop'
            }),
            Category.create({
                name: 'Snacks & Starters',
                description: 'Light bites and appetizers',
                businessId: business.id,
                outletId: outlet.id,
                displayOrder: 5,
                imageUrl: 'https://images.unsplash.com/photo-1565299624946-b28f40a0fe38?w=300&h=200&fit=crop'
            })
        ]);
        
        console.log(`✅ Created ${categories.length} categories`);
        
        // 8. Create Products
        console.log('🍽️ Creating menu products...');
        const Product = getProductModel(tenantSequelize);
        
        const products = [];
        
        // Coffee & Beverages
        const coffeeProducts = [
            { name: 'Cappuccino', price: 4.99, cost: 1.50, description: 'Rich espresso with steamed milk foam' },
            { name: 'Latte', price: 5.49, cost: 1.75, description: 'Smooth espresso with steamed milk' },
            { name: 'Americano', price: 3.99, cost: 1.00, description: 'Espresso with hot water' },
            { name: 'Espresso', price: 2.99, cost: 0.75, description: 'Strong shot of espresso' },
            { name: 'Cold Brew', price: 4.49, cost: 1.25, description: 'Smooth cold-brewed coffee' },
            { name: 'Green Tea', price: 3.49, cost: 0.50, description: 'Refreshing green tea' }
        ];
        
        // Breakfast
        const breakfastProducts = [
            { name: 'Avocado Toast', price: 8.99, cost: 3.50, description: 'Smashed avocado on artisan bread' },
            { name: 'Pancakes', price: 7.99, cost: 2.50, description: 'Fluffy pancakes with maple syrup' },
            { name: 'French Toast', price: 8.49, cost: 2.75, description: 'Cinnamon French toast with berries' },
            { name: 'Breakfast Burrito', price: 9.99, cost: 3.25, description: 'Scrambled eggs, bacon, cheese in tortilla' },
            { name: 'Oatmeal', price: 5.99, cost: 1.50, description: 'Warm oatmeal with fruits and nuts' }
        ];
        
        // Main Course
        const mainCourseProducts = [
            { name: 'Grilled Chicken Salad', price: 12.99, cost: 5.00, description: 'Grilled chicken breast with fresh greens' },
            { name: 'Beef Burger', price: 13.99, cost: 5.50, description: 'Juicy beef patty with toppings' },
            { name: 'Pasta Carbonara', price: 11.99, cost: 4.00, description: 'Classic Italian pasta with bacon and cream' },
            { name: 'Grilled Salmon', price: 16.99, cost: 7.00, description: 'Fresh Atlantic salmon with vegetables' },
            { name: 'Vegetarian Wrap', price: 9.99, cost: 3.50, description: 'Fresh vegetables in whole wheat wrap' }
        ];
        
        // Desserts
        const dessertProducts = [
            { name: 'Chocolate Cake', price: 6.99, cost: 2.00, description: 'Rich chocolate layer cake' },
            { name: 'Tiramisu', price: 7.49, cost: 2.50, description: 'Classic Italian coffee dessert' },
            { name: 'Ice Cream Sundae', price: 5.99, cost: 1.50, description: 'Vanilla ice cream with toppings' },
            { name: 'Cheesecake', price: 6.49, cost: 2.00, description: 'New York style cheesecake' }
        ];
        
        // Snacks & Starters
        const snackProducts = [
            { name: 'French Fries', price: 4.99, cost: 1.00, description: 'Crispy golden fries' },
            { name: 'Onion Rings', price: 5.49, cost: 1.25, description: 'Breaded onion rings' },
            { name: 'Mozzarella Sticks', price: 6.99, cost: 2.00, description: 'Breaded mozzarella with marinara' },
            { name: 'Chicken Wings', price: 8.99, cost: 3.00, description: 'Spicy buffalo wings' },
            { name: 'Nachos', price: 9.99, cost: 3.50, description: 'Loaded nachos with cheese and jalapeños' }
        ];
        
        const allProductData = [
            ...coffeeProducts.map(p => ({ ...p, categoryId: categories[0].id })),
            ...breakfastProducts.map(p => ({ ...p, categoryId: categories[1].id })),
            ...mainCourseProducts.map(p => ({ ...p, categoryId: categories[2].id })),
            ...dessertProducts.map(p => ({ ...p, categoryId: categories[3].id })),
            ...snackProducts.map(p => ({ ...p, categoryId: categories[4].id }))
        ];
        
        for (const productData of allProductData) {
            const product = await Product.create({
                name: productData.name,
                description: productData.description,
                price: productData.price,
                cost: productData.cost,
                sku: `SKU-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                barcode: `BAR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                imageUrl: `https://images.unsplash.com/photo-${Date.now()}-${Math.floor(Math.random() * 1000)}?w=400&h=300&fit=crop`,
                categoryId: productData.categoryId,
                businessId: business.id,
                outletId: outlet.id,
                isActive: true,
                trackInventory: false
            });
            products.push(product);
        }
        
        console.log(`✅ Created ${products.length} products`);
        
        // 9. Create Customers
        console.log('👥 Creating customers...');
        const Customer = getCustomerModel(tenantSequelize);
        
        const customerNames = [
            'John Smith', 'Emma Johnson', 'Michael Brown', 'Sarah Davis', 'James Wilson',
            'Lisa Anderson', 'Robert Taylor', 'Maria Garcia', 'David Martinez', 'Jennifer Lee'
        ];
        
        const customers = await Promise.all(customerNames.map((name, index) => {
            const [firstName, lastName] = name.split(' ');
            return Customer.create({
                name: name,
                email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
                phone: `${Math.floor(Math.random() * 9000000000) + 1000000000}`,
                address: `${Math.floor(Math.random() * 999) + 1} Demo Street, Demo City, DC ${Math.floor(Math.random() * 90000) + 10000}`,
                businessId: business.id,
                outletId: outlet.id,
                loyaltyPoints: Math.floor(Math.random() * 500),
                totalOrders: Math.floor(Math.random() * 20),
                totalSpent: Math.floor(Math.random() * 1000) + 50,
                isActive: true
            });
        }));
        
        console.log(`✅ Created ${customers.length} customers`);
        
        // 10. Create Sample Orders
        console.log('📦 Creating sample orders...');
        const Order = getOrderModel(tenantSequelize);
        const OrderItem = getOrderItemModel(tenantSequelize);
        
        const orders = [];
        const orderStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'completed'];
        const paymentStatuses = ['pending', 'paid'];
        
        // Generate orders for the last 7 days
        for (let day = 0; day < 7; day++) {
            const orderDate = new Date();
            orderDate.setDate(orderDate.getDate() - day);
            
            // Create 5-15 orders per day
            const ordersPerDay = Math.floor(Math.random() * 10) + 5;
            
            for (let i = 0; i < ordersPerDay; i++) {
                const customer = customers[Math.floor(Math.random() * customers.length)];
                const table = tables[Math.floor(Math.random() * tables.length)];
                
                // Create order
                const order = await Order.create({
                    orderNumber: `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
                    status: orderStatuses[Math.floor(Math.random() * orderStatuses.length)],
                    billingSubtotal: 0, // Will be calculated below
                    billingTax: 0,
                    billingDiscount: Math.random() > 0.8 ? Math.floor(Math.random() * 10) + 1 : 0,
                    billingTotal: 0, // Will be calculated below
                    customerId: customer.id,
                    businessId: business.id,
                    outletId: outlet.id,
                    tableId: table.id,
                    staffId: adminUser.id,
                    orderType: Math.random() > 0.7 ? 'takeaway' : 'dine_in',
                    paymentStatus: paymentStatuses[Math.floor(Math.random() * paymentStatuses.length)],
                    paymentMethod: Math.random() > 0.5 ? 'cash' : 'card',
                    notes: Math.random() > 0.8 ? 'Extra napkins please' : null,
                    createdAt: orderDate,
                    updatedAt: orderDate
                });
                
                // Add 2-5 items per order
                const itemCount = Math.floor(Math.random() * 4) + 2;
                let orderTotal = 0;
                
                for (let j = 0; j < itemCount; j++) {
                    const product = products[Math.floor(Math.random() * products.length)];
                    const quantity = Math.floor(Math.random() * 3) + 1;
                    const unitPrice = product.price;
                    const totalPrice = unitPrice * quantity;
                    
                    await OrderItem.create({
                        orderId: order.id,
                        productId: product.id,
                        name: product.name,
                        businessId: business.id,
                        quantity: quantity,
                        unitPrice: unitPrice,
                        price: unitPrice,
                        totalPrice: totalPrice,
                        notes: Math.random() > 0.9 ? 'No onions' : null
                    });
                    
                    orderTotal += totalPrice;
                }
                
                // Calculate tax and update order
                const taxAmount = orderTotal * 0.08; // 8% tax
                const finalTotal = orderTotal + taxAmount - order.billingDiscount;
                
                await order.update({
                    billingSubtotal: orderTotal,
                    billingTax: taxAmount,
                    billingTotal: finalTotal
                });
                
                orders.push(order);
            }
        }
        
        console.log(`✅ Created ${orders.length} orders`);
        
        // 11. Create Inventory Items
        console.log('📦 Creating inventory items...');
        const InventoryItem = getInventoryItemModel(tenantSequelize);
        
        const inventoryItems = [
            { name: 'Coffee Beans', category: 'Beverages', unit: 'kg', currentStock: 25, minStock: 5, cost: 15.00 },
            { name: 'Milk', category: 'Dairy', unit: 'liters', currentStock: 50, minStock: 10, cost: 3.50 },
            { name: 'Bread', category: 'Bakery', unit: 'pieces', currentStock: 100, minStock: 20, cost: 2.00 },
            { name: 'Chicken Breast', category: 'Meat', unit: 'kg', currentStock: 15, minStock: 3, cost: 12.00 },
            { name: 'Beef Patty', category: 'Meat', unit: 'kg', currentStock: 20, minStock: 5, cost: 18.00 },
            { name: 'Cheese', category: 'Dairy', unit: 'kg', currentStock: 10, minStock: 2, cost: 25.00 },
            { name: 'Lettuce', category: 'Vegetables', unit: 'kg', currentStock: 8, minStock: 2, cost: 4.00 },
            { name: 'Tomatoes', category: 'Vegetables', unit: 'kg', currentStock: 12, minStock: 3, cost: 5.00 },
            { name: 'Potatoes', category: 'Vegetables', unit: 'kg', currentStock: 30, minStock: 5, cost: 2.50 },
            { name: 'Cooking Oil', category: 'Pantry', unit: 'liters', currentStock: 20, minStock: 5, cost: 8.00 }
        ];
        
        for (const item of inventoryItems) {
            await InventoryItem.create({
                name: item.name,
                description: `Fresh ${item.name.toLowerCase()} for kitchen use`,
                sku: `INV-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
                category: item.category,
                unit: item.unit,
                currentStock: item.currentStock,
                minStock: item.minStock,
                maxStock: item.minStock * 5,
                cost: item.cost,
                sellingPrice: item.cost * 1.5,
                businessId: business.id,
                outletId: outlet.id,
                inventoryCategoryId: uuidv4(), // Generate category ID
                isActive: true
            });
        }
        
        console.log(`✅ Created ${inventoryItems.length} inventory items`);
        
        // 12. Update admin user with outlet assignment
        await adminUser.update({
            outletId: outlet.id
        });
        
        // 13. Print summary
        console.log('\n🎉 COMPLETE DEMO DATA CREATED SUCCESSFULLY!');
        console.log('\n📊 SUMMARY:');
        console.log(`✅ Business: ${business.name} (${business.id})`);
        console.log(`✅ Outlet: ${outlet.name} (${outlet.id})`);
        console.log(`✅ Admin User: ${adminUser.email} (Password: DemoPassword123!)`);
        console.log(`✅ Areas: ${areas.length}`);
        console.log(`✅ Tables: ${tables.length}`);
        console.log(`✅ Categories: ${categories.length}`);
        console.log(`✅ Products: ${products.length}`);
        console.log(`✅ Customers: ${customers.length}`);
        console.log(`✅ Orders: ${orders.length}`);
        console.log(`✅ Inventory Items: ${inventoryItems.length}`);
        
        console.log('\n🔑 LOGIN CREDENTIALS:');
        console.log(`Email: ${adminUser.email}`);
        console.log(`Password: DemoPassword123!`);
        console.log(`Backend URL: http://localhost:8000`);
        console.log(`Frontend URL: http://localhost:5173`);
        
        // Calculate total revenue
        const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.totalAmount), 0);
        console.log(`\n💰 Total Revenue from Sample Orders: $${totalRevenue.toFixed(2)}`);
        
    } catch (error) {
        console.error('❌ Demo data creation failed:', error.message);
        console.error('❌ Full error:', error);
        process.exit(1);
    } finally {
        await controlPlaneSequelize.close();
    }
}

createCompleteDemoData();
