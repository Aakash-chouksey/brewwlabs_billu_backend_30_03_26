const { sequelize } = require('../config/database_postgres');

// SECURITY LOCKDOWN: Prevent shared model access in runtime
if (process.env.NODE_ENV === 'production' || process.env.FORCE_TENANT_ISOLATION) {
    console.error('🚨 SECURITY: Shared models access forbidden in multi-tenant mode');
    console.error('🚨 All controllers must use getModelsForRequest(req) for tenant isolation');
    throw new Error('SECURITY_VIOLATION: Shared models access forbidden. Use getModelsForRequest(req) instead.');
}

const User = require('./userModel');
const Business = require('./businessModel');
const Outlet = require('./outletModel');
const Category = require('./categoryModel');
const Product = require('./productModel');
const Table = require('./tableModel');
const Order = require('./orderModel');
const Inventory = require('./inventoryModel');
const AuditLog = require('./auditLogModel');
const Payment = require('./paymentModel');
const Transaction = require('./transactionModel');
const Account = require('./accountModel');
const Area = require('./areaModel'); // Added Area
// Partner Modules
const MembershipPlan = require('./membershipPlanModel');
const PartnerType = require('./partnerTypeModel');
const PartnerWallet = require('./partnerWalletModel');
const PartnerMembership = require('./partnerMembershipModel');
const Setting = require('./settingModel');
const WebContent = require('./webContentModel');
const ExpenseType = require('./expenseTypeModel');
const Timing = require('./timingModel');
const Expense = require('./expenseModel');
const Income = require('./incomeModel');
const Purchase = require('./purchaseModel');
const FeatureFlag = require('./featureFlagModel');


// Define Associations

// Business & Outlet
Business.hasMany(Outlet, { foreignKey: 'businessId', as: 'outlets' });
Outlet.belongsTo(Business, { foreignKey: 'businessId', as: 'business' });

// User & Business
User.belongsTo(Business, { foreignKey: 'businessId', as: 'userBusiness' });
Business.hasMany(User, { foreignKey: 'businessId', as: 'staff' });
Business.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' }); // Owner of the business

// Category
Business.hasMany(Category, { foreignKey: 'businessId', as: 'categories' });
Category.belongsTo(Business, { foreignKey: 'businessId', as: 'business' });

// Area
Business.hasMany(Area, { foreignKey: 'businessId', as: 'areas' });
Area.belongsTo(Business, { foreignKey: 'businessId', as: 'business' });

Outlet.hasMany(Area, { foreignKey: 'outletId', as: 'areas' });
Area.belongsTo(Outlet, { foreignKey: 'outletId', as: 'outlet' });

// Product
Business.hasMany(Product, { foreignKey: 'businessId', as: 'products' });
Product.belongsTo(Business, { foreignKey: 'businessId', as: 'business' });

Category.hasMany(Product, { foreignKey: 'categoryId', as: 'products' });
Product.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });

// Table
Business.hasMany(Table, { foreignKey: 'businessId', as: 'tables' });
Table.belongsTo(Business, { foreignKey: 'businessId', as: 'business' });

Outlet.hasMany(Table, { foreignKey: 'outletId', as: 'tables' });
Table.belongsTo(Outlet, { foreignKey: 'outletId', as: 'outlet' });

// Area & Table (Optional, but good for filtering tables by area)
Area.hasMany(Table, { foreignKey: 'areaId', as: 'tables' });
Table.belongsTo(Area, { foreignKey: 'areaId', as: 'area' });

// Order
Business.hasMany(Order, { foreignKey: 'businessId', as: 'orders' });
Order.belongsTo(Business, { foreignKey: 'businessId', as: 'business' });

Outlet.hasMany(Order, { foreignKey: 'outletId', as: 'outletOrders' });
Order.belongsTo(Outlet, { foreignKey: 'outletId', as: 'outlet' });

Table.hasMany(Order, { foreignKey: 'tableId', as: 'orders' });
Order.belongsTo(Table, { foreignKey: 'tableId', as: 'table' });

User.hasMany(Order, { foreignKey: 'waiterId', as: 'orders' });
Order.belongsTo(User, { foreignKey: 'waiterId', as: 'waiter' });

// Inventory
Business.hasMany(Inventory, { foreignKey: 'businessId', as: 'inventory' });
Inventory.belongsTo(Business, { foreignKey: 'businessId', as: 'business' });

Outlet.hasMany(Inventory, { foreignKey: 'outletId', as: 'outletInventory' });
Inventory.belongsTo(Outlet, { foreignKey: 'outletId', as: 'outlet' });

// AuditLog
User.hasMany(AuditLog, { foreignKey: 'userId', as: 'auditLogs' });
AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Payment
Business.hasMany(Payment, { foreignKey: 'businessId', as: 'payments' });
Payment.belongsTo(Business, { foreignKey: 'businessId', as: 'business' });

Outlet.hasMany(Payment, { foreignKey: 'outletId', as: 'outletPayments' });
Payment.belongsTo(Outlet, { foreignKey: 'outletId', as: 'outlet' });

Order.hasMany(Payment, { foreignKey: 'internalOrderId', as: 'transactions' });
Payment.belongsTo(Order, { foreignKey: 'internalOrderId', as: 'order' });

// Transaction & Account
Business.hasMany(Transaction, { foreignKey: 'businessId', as: 'transactions' });
Transaction.belongsTo(Business, { foreignKey: 'businessId', as: 'business' });

Business.hasMany(Account, { foreignKey: 'businessId', as: 'accounts' });
Account.belongsTo(Business, { foreignKey: 'businessId', as: 'business' });

Outlet.hasMany(Account, { foreignKey: 'outletId', as: 'outletAccounts' });
Account.belongsTo(Outlet, { foreignKey: 'outletId', as: 'outlet' });

Account.hasMany(Transaction, { foreignKey: 'accountId', as: 'transactions' });
Transaction.belongsTo(Account, { foreignKey: 'accountId', as: 'account' });

Transaction.belongsTo(User, { foreignKey: 'performedBy', as: 'user' });

// Partner Associations
Business.hasOne(PartnerWallet, { foreignKey: 'businessId', as: 'wallet' });
PartnerWallet.belongsTo(Business, { foreignKey: 'businessId', as: 'business' });

Business.hasMany(PartnerMembership, { foreignKey: 'businessId', as: 'memberships' });
PartnerMembership.belongsTo(Business, { foreignKey: 'businessId', as: 'business' });

PartnerMembership.belongsTo(MembershipPlan, { foreignKey: 'planId', as: 'plan' });
MembershipPlan.hasMany(PartnerMembership, { foreignKey: 'planId', as: 'memberships' });

// ExpenseType
Business.hasMany(ExpenseType, { foreignKey: 'businessId', as: 'expenseTypes' });
ExpenseType.belongsTo(Business, { foreignKey: 'businessId', as: 'business' });

// Timing
Outlet.hasMany(Timing, { foreignKey: 'outletId', as: 'timings' });
Timing.belongsTo(Outlet, { foreignKey: 'outletId', as: 'outlet' });

// Expense
Business.hasMany(Expense, { foreignKey: 'businessId', as: 'expenses' });
Expense.belongsTo(Business, { foreignKey: 'businessId', as: 'business' });
Outlet.hasMany(Expense, { foreignKey: 'outletId', as: 'outletExpenses' });
Expense.belongsTo(Outlet, { foreignKey: 'outletId', as: 'outlet' });
ExpenseType.hasMany(Expense, { foreignKey: 'expenseTypeId', as: 'expenses' });
Expense.belongsTo(ExpenseType, { foreignKey: 'expenseTypeId', as: 'type' });

// Income
Business.hasMany(Income, { foreignKey: 'businessId', as: 'incomes' });
Income.belongsTo(Business, { foreignKey: 'businessId', as: 'business' });
Outlet.hasMany(Income, { foreignKey: 'outletId', as: 'outletIncomes' });
Income.belongsTo(Outlet, { foreignKey: 'outletId', as: 'outlet' });

// Purchase
Business.hasMany(Purchase, { foreignKey: 'businessId', as: 'purchases' });
Purchase.belongsTo(Business, { foreignKey: 'businessId', as: 'business' });
Outlet.hasMany(Purchase, { foreignKey: 'outletId', as: 'outletPurchases' });
Purchase.belongsTo(Outlet, { foreignKey: 'outletId', as: 'outlet' });

module.exports = { 
    sequelize, 
    User, 
    Business, 
    Outlet, 
    Area, 
    Category,
    Product,
    Table,
    Order,
    Inventory,
    AuditLog,
    Payment,
    Transaction,
    Account,
    MembershipPlan,
    PartnerType,
    PartnerWallet,
    PartnerMembership,
    Setting,
    WebContent,
    ExpenseType,
    Timing,
    Expense,
    Income,
    Purchase,
    FeatureFlag
};
