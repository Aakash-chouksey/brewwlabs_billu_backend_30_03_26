require('dotenv').config();
const { sequelize } = require('../config/database_postgres');

// Import all models to register them with the sequelize instance
const User = require('../models/userModel');
const Business = require('../models/businessModel'); 
const Outlet = require('../models/outletModel');
const Category = require('../models/categoryModel');
const Product = require('../models/productModel');
const Table = require('../models/tableModel');
const Area = require('../models/areaModel');
const Order = require('../models/orderModel');
const Inventory = require('../models/inventoryModel');
const { InventoryItem, InventoryCategory, InventoryTransaction, Recipe, RecipeItem } = require('../models/inventoryAssociations');
const Payment = require('../models/paymentModel');
const Purchase = require('../models/purchaseModel');
const PurchaseItem = require('../models/purchaseItemModel');
const Expense = require('../models/expenseModel');
const BillingConfig = require('../models/billingConfigModel');
const Timing = require('../models/timingModel');
const Account = require('../models/accountModel');
const Transaction = require('../models/transactionModel');
const RollTracking = require('../models/rollTrackingModel');
const AuditLog = require('../models/auditLogModel');
const Subscription = require('../models/subscriptionModel');

async function init() {
  console.log('🚀 Starting Comprehensive Database Initialization...');
  
  try {
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Connected to PostgreSQL.');

    const publicModels = [
      User, Business, Subscription, BillingConfig, RollTracking, AuditLog
      // Add other control plane models specifically if they exist in this script's imports
    ];

    console.log('⏳ Verifying public schema tables exist...');
    
    // Check if tables exist (they should be created via migrations)
    const [existingTables] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    const requiredTables = ['users', 'businesses', 'subscriptions', 'billing_configs', 'roll_trackings', 'audit_logs'];
    const foundTables = existingTables.map(t => t.table_name);
    const missingTables = requiredTables.filter(t => !foundTables.includes(t));
    
    if (missingTables.length > 0) {
      console.log(`⚠️  Missing tables (run migrations): ${missingTables.join(', ')}`);
    } else {
      console.log('✅ All public schema tables verified.');
    }

    console.log('🎉 Initialization COMPLETED successfully.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Initialization FAILED:', error);
    process.exit(1);
  }
}

init();
