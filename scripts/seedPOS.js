/**
 * SEED POS DATA - Multi-tenant Seeding Script
 * Usage: node scripts/seedPOS.js --tenant=TENANT_ID
 */

const { v4: uuidv4 } = require('uuid');
const neonTransactionSafeExecutor = require('../services/neonTransactionSafeExecutor');
const { CONTROL_PLANE } = require('../src/utils/constants');

// Parse args
const args = process.argv.slice(2);
const tenantArg = args.find(a => a.startsWith('--tenant='));
const tenantId = tenantArg ? tenantArg.split('=')[1] : null;

if (!tenantId) {
    console.error('❌ ERROR: Missing tenant ID. Usage: node scripts/seedPOS.js --tenant=YOUR_TENANT_ID');
    process.exit(1);
}

async function seed() {
    console.log(`🚀 Starting POS Seed for Tenant: ${tenantId}`);

    try {
        await neonTransactionSafeExecutor.executeWithTenant(tenantId, async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Outlet, Area, Table, Category, Product, Order, OrderItem } = models;

            // 1. Get Outlet
            const outlet = await Outlet.findOne({ where: { businessId: tenantId }, transaction });
            if (!outlet) {
                throw new Error(`No outlet found for tenant ${tenantId}. Create an outlet first.`);
            }
            const outletId = outlet.id;
            console.log(`📍 Found Outlet: ${outlet.name} (${outletId})`);

            // 2. Clear Existing Data (Optional but recommended for clean slate)
            console.log('🧹 Clearing old POS data...');
            await OrderItem.destroy({ where: { outletId }, transaction });
            await Order.destroy({ where: { outletId }, transaction });
            await Table.destroy({ where: { outletId }, transaction });
            await Area.destroy({ where: { outletId }, transaction });

            // 3. Create Areas
            console.log('🏗️ Creating Table Areas...');
            const mainArea = await Area.create({
                id: uuidv4(),
                businessId: tenantId,
                outletId,
                name: 'Main Dining',
                description: 'Ground Floor seating',
                status: 'active'
            }, { transaction });

            const terrace = await Area.create({
                id: uuidv4(),
                businessId: tenantId,
                outletId,
                name: 'Terrace',
                description: 'Outdoor rooftop seating',
                status: 'active'
            }, { transaction });

            // 4. Create Tables
            console.log('🪑 Creating Tables...');
            const tables = [];
            
            // 6 tables in Main Area
            for (let i = 1; i <= 6; i++) {
                tables.push(await Table.create({
                    id: uuidv4(),
                    businessId: tenantId,
                    outletId,
                    tableNo: `T${i}`,
                    name: `Table ${i}`,
                    capacity: i % 2 === 0 ? 4 : 2,
                    areaId: mainArea.id,
                    status: 'Available'
                }, { transaction }));
            }

            // 4 tables in terrace
            for (let i = 7; i <= 10; i++) {
                tables.push(await Table.create({
                    id: uuidv4(),
                    businessId: tenantId,
                    outletId,
                    tableNo: `T${i}`,
                    name: `Table ${i}`,
                    capacity: 4,
                    areaId: terrace.id,
                    status: 'Available'
                }, { transaction }));
            }

            // 5. Ensure we have products
            let sampleProduct = await Product.findOne({ where: { businessId: tenantId }, transaction });
            if (!sampleProduct) {
                console.log('📦 No products found. Creating sample category and product...');
                const cat = await Category.create({
                    id: uuidv4(),
                    businessId: tenantId,
                    outletId,
                    name: 'Beverages',
                    isEnabled: true
                }, { transaction });

                sampleProduct = await Product.create({
                    id: uuidv4(),
                    businessId: tenantId,
                    outletId,
                    name: 'Cappuccino',
                    price: 180,
                    categoryId: cat.id,
                    isActive: true
                }, { transaction });
            }

            // 6. Generate Live Orders (KOT_SENT)
            console.log('📝 Generating Live Orders...');
            for (let i = 0; i < 3; i++) {
                const table = tables[i];
                const order = await Order.create({
                    id: uuidv4(),
                    businessId: tenantId,
                    outletId,
                    tableId: table.id,
                    orderNumber: `ORD-${Date.now()}-${i}`,
                    status: 'KOT_SENT',
                    billingSubtotal: sampleProduct.price,
                    billingTotal: sampleProduct.price,
                    type: 'DINE_IN'
                }, { transaction });

                await OrderItem.create({
                    id: uuidv4(),
                    businessId: tenantId,
                    outletId,
                    orderId: order.id,
                    productId: sampleProduct.id,
                    name: sampleProduct.name,
                    quantity: 1,
                    price: sampleProduct.price,
                    subtotal: sampleProduct.price
                }, { transaction });

                // Mark table occupied
                await table.update({ status: 'Occupied', currentOrderId: order.id }, { transaction });
            }

            // 7. Generate Historical Orders (COMPLETED)
            console.log('📜 Generating Historical Orders...');
            for (let i = 0; i < 10; i++) {
                const order = await Order.create({
                    id: uuidv4(),
                    businessId: tenantId,
                    outletId,
                    orderNumber: `ORD-HIST-${1000 + i}`,
                    status: 'COMPLETED',
                    billingSubtotal: sampleProduct.price * 2,
                    billingTotal: sampleProduct.price * 2,
                    type: 'DINE_IN',
                    createdAt: new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000) // Days ago
                }, { transaction });

                await OrderItem.create({
                    id: uuidv4(),
                    businessId: tenantId,
                    outletId,
                    orderId: order.id,
                    productId: sampleProduct.id,
                    name: sampleProduct.name,
                    quantity: 2,
                    price: sampleProduct.price,
                    subtotal: sampleProduct.price * 2
                }, { transaction });
            }

            console.log('✅ Seed Data Completed Successfully!');
            return true;
        });

        process.exit(0);
    } catch (error) {
        console.error('❌ SEED FAILED:', error);
        process.exit(1);
    }
}

seed();
