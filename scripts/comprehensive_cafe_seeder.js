#!/usr/bin/env node

/**
 * COMPREHENSIVE CAFE DATA SEEDER
 * 
 * This script populates the database with realistic cafe data
 * for a complete running cafe scenario with proper tenant context.
 * 
 * Usage: node scripts/comprehensive_cafe_seeder.js
 */

require('dotenv').config();
const { v4: uuidv4 } = require('uuid');

// Database connection
// Database connection - NEON SAFE
const neonTransactionSafeExecutor = require('../src/services/neonTransactionSafeExecutor');
const { CONTROL_PLANE } = require('../src/utils/constants');

// Sample data generator
class CafeDataSeeder {
  constructor(businessId, outletId) {
    this.businessId = businessId;
    this.brandId = businessId; // Keep for internal logic
    this.outletId = outletId;
  }

  generateCompleteCafeData() {
    console.log('🌱 Generating complete cafe dataset...');
    
    this.data = {};
    this.data.categories = this.generateCategories();
    this.data.productTypes = this.generateProductTypes();
    this.data.products = this.generateProducts();
    this.data.inventory = this.generateInventory();
    this.data.staff = this.generateStaff();
    this.data.areas = this.generateAreas();
    this.data.tables = this.generateTables();
    this.data.operationTimings = this.generateOperationTimings();
    this.data.orders = this.generateOrders();
    this.data.transactions = this.generateTransactions();
    this.data.expenseTypes = this.generateExpenseTypes();
    this.data.accounts = this.generateAccounts();
    
    return this.data;
  }

  generateCategories() {
    return [
      { 
        id: uuidv4(),
        name: 'Beverages', 
        description: 'Hot and cold drinks including coffee, tea, and juices', 
        color: '#3B82F6',
        businessId: this.businessId,
        outletId: this.outletId,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      { 
        id: uuidv4(),
        name: 'Food', 
        description: 'Main course items including sandwiches, wraps, and meals', 
        color: '#10B981',
        businessId: this.businessId,
        outletId: this.outletId,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      { 
        id: uuidv4(),
        name: 'Desserts', 
        description: 'Sweet treats including cakes, pastries, and ice cream', 
        color: '#F59E0B',
        businessId: this.businessId,
        outletId: this.outletId,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      { 
        id: uuidv4(),
        name: 'Snacks', 
        description: 'Light bites and appetizers', 
        color: '#EF4444',
        businessId: this.businessId,
        outletId: this.outletId,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      { 
        id: uuidv4(),
        name: 'Breakfast', 
        description: 'Breakfast items and morning specials', 
        color: '#8B5CF6',
        businessId: this.businessId,
        outletId: this.outletId,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  }

  generateProductTypes() {
    return [
      { 
        id: uuidv4(),
        name: 'Coffee', 
        description: 'Various coffee preparations and espresso drinks', 
        icon: '☕',
        businessId: this.businessId,
        outletId: this.outletId,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      { 
        id: uuidv4(),
        name: 'Tea', 
        description: 'Tea varieties and herbal infusions', 
        icon: '🍵',
        businessId: this.businessId,
        outletId: this.outletId,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      { 
        id: uuidv4(),
        name: 'Juice', 
        description: 'Fresh fruit juices and smoothies', 
        icon: '🧃',
        businessId: this.businessId,
        outletId: this.outletId,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      { 
        id: uuidv4(),
        name: 'Sandwich', 
        description: 'Fresh sandwiches and wraps', 
        icon: '🥪',
        businessId: this.businessId,
        outletId: this.outletId,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      { 
        id: uuidv4(),
        name: 'Pastry', 
        description: 'Baked goods and desserts', 
        icon: '🥐',
        businessId: this.businessId,
        outletId: this.outletId,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      { 
        id: uuidv4(),
        name: 'Breakfast', 
        description: 'Breakfast specialties and morning items', 
        icon: '🍳',
        businessId: this.businessId,
        outletId: this.outletId,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  }

  generateProducts() {
    const products = [
      // Coffee Beverages
      { id: uuidv4(), name: 'Espresso', price: 80, description: 'Strong black coffee shot', categoryId: this.getCategoryId('Beverages'), productTypeId: this.getProductTypeId('Coffee'), isAvailable: true, brandId: this.brandId, outletId: this.outletId },
      { id: uuidv4(), name: 'Cappuccino', price: 120, description: 'Espresso with steamed milk foam', categoryId: this.getCategoryId('Beverages'), productTypeId: this.getProductTypeId('Coffee'), isAvailable: true, brandId: this.brandId, outletId: this.outletId },
      { id: uuidv4(), name: 'Latte', price: 140, description: 'Espresso with lots of steamed milk', categoryId: this.getCategoryId('Beverages'), productTypeId: this.getProductTypeId('Coffee'), isAvailable: true, brandId: this.brandId, outletId: this.outletId },
      { id: uuidv4(), name: 'Americano', price: 100, description: 'Espresso with hot water', categoryId: this.getCategoryId('Beverages'), productTypeId: this.getProductTypeId('Coffee'), isAvailable: true, brandId: this.brandId, outletId: this.outletId },
      { id: uuidv4(), name: 'Mocha', price: 160, description: 'Espresso with chocolate and steamed milk', categoryId: this.getCategoryId('Beverages'), productTypeId: this.getProductTypeId('Coffee'), isAvailable: true, brandId: this.brandId, outletId: this.outletId },
      
      // Tea Beverages
      { id: uuidv4(), name: 'Green Tea', price: 60, description: 'Fresh green tea leaves', categoryId: this.getCategoryId('Beverages'), productTypeId: this.getProductTypeId('Tea'), isAvailable: true, brandId: this.brandId, outletId: this.outletId },
      { id: uuidv4(), name: 'Masala Chai', price: 80, description: 'Indian spiced tea with milk', categoryId: this.getCategoryId('Beverages'), productTypeId: this.getProductTypeId('Tea'), isAvailable: true, brandId: this.brandId, outletId: this.outletId },
      { id: uuidv4(), name: 'Iced Tea', price: 70, description: 'Cold brewed tea with ice', categoryId: this.getCategoryId('Beverages'), productTypeId: this.getProductTypeId('Tea'), isAvailable: true, brandId: this.brandId, outletId: this.outletId },
      
      // Juices
      { id: uuidv4(), name: 'Orange Juice', price: 100, description: 'Fresh squeezed orange juice', categoryId: this.getCategoryId('Beverages'), productTypeId: this.getProductTypeId('Juice'), isAvailable: true, brandId: this.brandId, outletId: this.outletId },
      { id: uuidv4(), name: 'Mango Smoothie', price: 120, description: 'Mango smoothie with yogurt', categoryId: this.getCategoryId('Beverages'), productTypeId: this.getProductTypeId('Juice'), isAvailable: true, brandId: this.brandId, outletId: this.outletId },
      
      // Food Items
      { id: uuidv4(), name: 'Club Sandwich', price: 180, description: 'Triple decker club sandwich', categoryId: this.getCategoryId('Food'), productTypeId: this.getProductTypeId('Sandwich'), isAvailable: true, brandId: this.brandId, outletId: this.outletId },
      { id: uuidv4(), name: 'Veggie Wrap', price: 160, description: 'Grilled vegetables in tortilla wrap', categoryId: this.getCategoryId('Food'), productTypeId: this.getProductTypeId('Sandwich'), isAvailable: true, brandId: this.brandId, outletId: this.outletId },
      { id: uuidv4(), name: 'Grilled Cheese', price: 200, description: 'Grilled cheese sandwich with tomato', categoryId: this.getCategoryId('Food'), productTypeId: this.getProductTypeId('Sandwich'), isAvailable: true, brandId: this.brandId, outletId: this.outletId },
      { id: uuidv4(), name: 'Chicken Burger', price: 220, description: 'Grilled chicken patty burger', categoryId: this.getCategoryId('Food'), productTypeId: this.getProductTypeId('Sandwich'), isAvailable: true, brandId: this.brandId, outletId: this.outletId },
      
      // Breakfast Items
      { id: uuidv4(), name: 'Masala Dosa', price: 90, description: 'South Indian dosa with potato filling', categoryId: this.getCategoryId('Breakfast'), productTypeId: this.getProductTypeId('Breakfast'), isAvailable: true, brandId: this.brandId, outletId: this.outletId },
      { id: uuidv4(), name: 'Upma', price: 70, description: 'Savory semolina porridge', categoryId: this.getCategoryId('Breakfast'), productTypeId: this.getProductTypeId('Breakfast'), isAvailable: true, brandId: this.brandId, outletId: this.outletId },
      { id: uuidv4(), name: 'Poha', price: 60, description: 'Flattened rice with onions and spices', categoryId: this.getCategoryId('Breakfast'), productTypeId: this.getProductTypeId('Breakfast'), isAvailable: true, brandId: this.brandId, outletId: this.outletId },
      
      // Desserts
      { id: uuidv4(), name: 'Chocolate Cake', price: 120, description: 'Rich chocolate cake slice', categoryId: this.getCategoryId('Desserts'), productTypeId: this.getProductTypeId('Pastry'), isAvailable: true, brandId: this.brandId, outletId: this.outletId },
      { id: uuidv4(), name: 'Tiramisu', price: 150, description: 'Classic Italian coffee dessert', categoryId: this.getCategoryId('Desserts'), productTypeId: this.getProductTypeId('Pastry'), isAvailable: true, brandId: this.brandId, outletId: this.outletId },
      { id: uuidv4(), name: 'Gulab Jamun', price: 80, description: 'Indian sweet dumpling in sugar syrup', categoryId: this.getCategoryId('Desserts'), productTypeId: this.getProductTypeId('Pastry'), isAvailable: true, brandId: this.brandId, outletId: this.outletId },
      { id: uuidv4(), name: 'Ice Cream Scoop', price: 60, description: 'Vanilla ice cream scoop', categoryId: this.getCategoryId('Desserts'), productTypeId: this.getProductTypeId('Pastry'), isAvailable: true, brandId: this.brandId, outletId: this.outletId },
      
      // Snacks
      { id: uuidv4(), name: 'French Fries', price: 90, description: 'Crispy golden french fries', categoryId: this.getCategoryId('Snacks'), productTypeId: this.getProductTypeId('Sandwich'), isAvailable: true, brandId: this.brandId, outletId: this.outletId },
      { id: uuidv4(), name: 'Samosa', price: 40, description: 'Crispy pastry with spiced filling', categoryId: this.getCategoryId('Snacks'), productTypeId: this.getProductTypeId('Sandwich'), isAvailable: true, brandId: this.brandId, outletId: this.outletId },
      { id: uuidv4(), name: 'Onion Rings', price: 100, description: 'Crispy battered onion rings', categoryId: this.getCategoryId('Snacks'), productTypeId: this.getProductTypeId('Sandwich'), isAvailable: true, brandId: this.brandId, outletId: this.outletId }
    ];

    return products.map(product => ({
      ...product,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
  }

  generateInventory() {
    return [
      { id: uuidv4(), name: 'Coffee Beans', category: 'Raw Materials', stock: 50, unit: 'kg', price: 500, minStock: 10, businessId: this.businessId, outletId: this.outletId, createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name: 'Milk', category: 'Dairy', stock: 20, unit: 'liters', price: 60, minStock: 5, businessId: this.businessId, outletId: this.outletId, createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name: 'Sugar', category: 'Raw Materials', stock: 100, unit: 'kg', price: 40, minStock: 10, businessId: this.businessId, outletId: this.outletId, createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name: 'Bread', category: 'Bakery', stock: 30, unit: 'pieces', price: 20, minStock: 10, businessId: this.businessId, outletId: this.outletId, createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name: 'Cheese', category: 'Dairy', stock: 15, unit: 'kg', price: 400, minStock: 5, businessId: this.businessId, outletId: this.outletId, createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name: 'Vegetables', category: 'Produce', stock: 25, unit: 'kg', price: 80, minStock: 5, businessId: this.businessId, outletId: this.outletId, createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name: 'Chicken', category: 'Meat', stock: 20, unit: 'kg', price: 200, minStock: 5, businessId: this.businessId, outletId: this.outletId, createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name: 'Flour', category: 'Raw Materials', stock: 40, unit: 'kg', price: 30, minStock: 10, businessId: this.businessId, outletId: this.outletId, createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name: 'Rice', category: 'Raw Materials', stock: 60, unit: 'kg', price: 50, minStock: 15, businessId: this.businessId, outletId: this.outletId, createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name: 'Oil', category: 'Raw Materials', stock: 30, unit: 'liters', price: 120, minStock: 5, businessId: this.businessId, outletId: this.outletId, createdAt: new Date(), updatedAt: new Date() }
    ];
  }

  generateStaff() {
    return [
      { 
        id: uuidv4(),
        name: 'John Smith', 
        email: 'john@cafe.com', 
        phone: '+91 98765 43210', 
        role: 'Manager',
        status: 'active',
        performance: 5,
        totalOrders: 450,
        rating: 4.8,
        experience: 5,
        salary: 45000,
        password: '$2a$10$XmPRv61PjW6oV.GfH2kCOuae/DshM5.YvHlGvE0C7xX7vN/m9l0oW',
        businessId: this.businessId,
        outletId: this.outletId,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      { 
        id: uuidv4(),
        name: 'Sarah Johnson', 
        email: 'sarah@cafe.com', 
        phone: '+91 98765 43211', 
        role: 'Barista',
        status: 'active',
        performance: 4,
        totalOrders: 380,
        rating: 4.5,
        experience: 3,
        salary: 25000,
        password: '$2a$10$XmPRv61PjW6oV.GfH2kCOuae/DshM5.YvHlGvE0C7xX7vN/m9l0oW',
        businessId: this.businessId,
        outletId: this.outletId,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      { 
        id: uuidv4(),
        name: 'Mike Wilson', 
        email: 'mike@cafe.com', 
        phone: '+91 98765 43212', 
        role: 'Waiter',
        status: 'active',
        performance: 4,
        totalOrders: 320,
        rating: 4.2,
        experience: 2,
        salary: 20000,
        password: '$2a$10$XmPRv61PjW6oV.GfH2kCOuae/DshM5.YvHlGvE0C7xX7vN/m9l0oW',
        businessId: this.businessId,
        outletId: this.outletId,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      { 
        id: uuidv4(),
        name: 'Emily Brown', 
        email: 'emily@cafe.com', 
        phone: '+91 98765 43213', 
        role: 'Cashier',
        status: 'active',
        performance: 3,
        totalOrders: 280,
        rating: 3.9,
        experience: 1,
        salary: 18000,
        password: '$2a$10$XmPRv61PjW6oV.GfH2kCOuae/DshM5.YvHlGvE0C7xX7vN/m9l0oW',
        businessId: this.businessId,
        outletId: this.outletId,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  }

  generateAreas() {
    return [
      { 
        id: uuidv4(),
        name: 'Indoor Seating', 
        description: 'Main dining area with comfortable seating', 
        capacity: 24,
        businessId: this.businessId,
        outletId: this.outletId,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      { 
        id: uuidv4(),
        name: 'Outdoor Patio', 
        description: 'Outdoor seating area with garden view', 
        capacity: 16,
        businessId: this.businessId,
        outletId: this.outletId,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      { 
        id: uuidv4(),
        name: 'Private Dining', 
        description: 'Private event space for special occasions', 
        capacity: 20,
        businessId: this.businessId,
        outletId: this.outletId,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  }

  generateTables() {
    return [
      { id: uuidv4(), name: 'Table 1', tableNo: 'T001', capacity: 4, areaId: this.getAreaId('Indoor Seating'), status: 'Available', businessId: this.businessId, outletId: this.outletId, createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name: 'Table 2', tableNo: 'T002', capacity: 4, areaId: this.getAreaId('Indoor Seating'), status: 'Available', businessId: this.businessId, outletId: this.outletId, createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name: 'Table 3', tableNo: 'T003', capacity: 6, areaId: this.getAreaId('Indoor Seating'), status: 'Available', businessId: this.businessId, outletId: this.outletId, createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name: 'Table 4', tableNo: 'T004', capacity: 2, areaId: this.getAreaId('Outdoor Patio'), status: 'Available', businessId: this.businessId, outletId: this.outletId, createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name: 'Table 5', tableNo: 'T005', capacity: 2, areaId: this.getAreaId('Outdoor Patio'), status: 'Available', businessId: this.businessId, outletId: this.outletId, createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name: 'Table 6', tableNo: 'T006', capacity: 8, areaId: this.getAreaId('Private Dining'), status: 'Available', businessId: this.businessId, outletId: this.outletId, createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name: 'Table 7', tableNo: 'T007', capacity: 8, areaId: this.getAreaId('Private Dining'), status: 'Available', businessId: this.businessId, outletId: this.outletId, createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name: 'Table 8', tableNo: 'T008', capacity: 4, areaId: this.getAreaId('Private Dining'), status: 'Available', businessId: this.businessId, outletId: this.outletId, createdAt: new Date(), updatedAt: new Date() }
    ];
  }

  generateOperationTimings() {
    return [
      { id: uuidv4(), day: 'Monday', isClosed: false, openTime: '08:00', closeTime: '23:00', businessId: this.businessId, outletId: this.outletId, createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), day: 'Tuesday', isClosed: false, openTime: '08:00', closeTime: '23:00', businessId: this.businessId, outletId: this.outletId, createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), day: 'Wednesday', isClosed: false, openTime: '08:00', closeTime: '23:00', businessId: this.businessId, outletId: this.outletId, createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), day: 'Thursday', isClosed: false, openTime: '08:00', closeTime: '23:00', businessId: this.businessId, outletId: this.outletId, createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), day: 'Friday', isClosed: false, openTime: '08:00', closeTime: '00:00', businessId: this.businessId, outletId: this.outletId, createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), day: 'Saturday', isClosed: false, openTime: '09:00', closeTime: '00:00', businessId: this.businessId, outletId: this.outletId, createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), day: 'Sunday', isClosed: false, openTime: '09:00', closeTime: '23:00', businessId: this.businessId, outletId: this.outletId, createdAt: new Date(), updatedAt: new Date() }
    ];
  }

  generateOrders() {
    const orders = [];
    const productIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
    
    // Generate orders for the last 30 days
    for (let i = 0; i < 30; i++) {
      const orderDate = new Date(Date.now() - (i * 86400000));
      const orderCount = Math.floor(Math.random() * 15) + 10; // 10-25 orders per day
      
      for (let j = 0; j < orderCount; j++) {
        const orderTime = new Date(orderDate.getTime() + (j * 3600000)); // Every hour
        const customerName = `Customer ${Math.floor(Math.random() * 1000)}`;
        const itemCount = Math.floor(Math.random() * 4) + 1; // 1-4 items per order
        const totalAmount = Math.floor(Math.random() * 400) + 100; // 100-500 per order
        const statuses = ['completed', 'preparing', 'ready', 'served'];
        
        orders.push({
          id: uuidv4(),
          customerDetails: { name: customerName },
          orderNumber: `O${Date.now().toString().slice(-8)}${j}`,
          status: statuses[Math.floor(Math.random() * statuses.length)].toUpperCase(),
          billing_total: totalAmount,
          billing_subtotal: totalAmount,
          billing_tax: 0,
          billing_discount: 0,
          createdAt: orderTime,
          updatedAt: orderTime,
          businessId: this.businessId,
          outletId: this.outletId,
          items: this.generateOrderItems(itemCount, productIds)
        });
      }
    }
    
    return orders;
  }

  generateOrderItems(count, productIds) {
    const items = [];
    
    for (let i = 0; i < count; i++) {
      const productId = productIds[Math.floor(Math.random() * productIds.length)];
      const quantity = Math.floor(Math.random() * 3) + 1; // 1-3 quantity
      const price = 60 + Math.floor(Math.random() * 140); // 60-200 price range
      
      items.push({
        id: uuidv4(),
        productId,
        quantity,
        price,
        name: `Product ${productId}`,
        total: quantity * price
      });
    }
    
    return items;
  }

  generateTransactions() {
    const transactions = [];
    
    // Generate transactions for the last 30 days
    for (let i = 0; i < 30; i++) {
      const transactionDate = new Date(Date.now() - (i * 86400000));
      
      // Income transactions
      transactions.push({
        id: uuidv4(),
        type: 'Income',
        category: 'Food Sales',
        amount: Math.floor(Math.random() * 10000) + 8000, // 8000-18000
        description: 'Daily food sales revenue',
        date: transactionDate,
        businessId: this.businessId,
        outletId: this.outletId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      transactions.push({
        id: uuidv4(),
        type: 'Income',
        category: 'Beverage Sales',
        amount: Math.floor(Math.random() * 6000) + 4000, // 4000-10000
        description: 'Daily beverage sales revenue',
        date: transactionDate,
        businessId: this.businessId,
        outletId: this.outletId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      transactions.push({
        id: uuidv4(),
        type: 'Income',
        category: 'Dessert Sales',
        amount: Math.floor(Math.random() * 3000) + 2000, // 2000-5000
        description: 'Daily dessert sales revenue',
        date: transactionDate,
        businessId: this.businessId,
        outletId: this.outletId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      // Expense transactions
      transactions.push({
        id: uuidv4(),
        type: 'Expense',
        category: 'Raw Materials',
        amount: Math.floor(Math.random() * 5000) + 3000, // 3000-8000
        description: 'Daily raw material purchase',
        date: transactionDate,
        businessId: this.businessId,
        outletId: this.outletId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      transactions.push({
        id: uuidv4(),
        type: 'Expense',
        category: 'Utilities',
        amount: Math.floor(Math.random() * 2000) + 1000, // 1000-3000
        description: 'Daily electricity and water bill',
        date: transactionDate,
        businessId: this.businessId,
        outletId: this.outletId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      transactions.push({
        id: uuidv4(),
        type: 'Expense',
        category: 'Salaries',
        amount: Math.floor(Math.random() * 8000) + 6000, // 6000-14000
        description: 'Daily staff wages and salaries',
        date: transactionDate,
        businessId: this.businessId,
        outletId: this.outletId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    return transactions;
  }

  generateExpenseTypes() {
    return [
      { id: uuidv4(), name: 'Raw Materials', description: 'Coffee beans, milk, sugar, flour', businessId: this.businessId, outletId: this.outletId, createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name: 'Utilities', description: 'Electricity, water, gas bills', businessId: this.businessId, outletId: this.outletId, createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name: 'Salaries', description: 'Staff wages and benefits', businessId: this.businessId, outletId: this.outletId, createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name: 'Maintenance', description: 'Equipment repair and maintenance', businessId: this.businessId, outletId: this.outletId, createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name: 'Marketing', description: 'Advertising and promotional expenses', businessId: this.businessId, outletId: this.outletId, createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name: 'Rent', description: 'Property rent and lease', businessId: this.businessId, outletId: this.outletId, createdAt: new Date(), updatedAt: new Date() }
    ];
  }

  generateAccounts() {
    return [
      { id: uuidv4(), name: 'Main Cash Account', type: 'Cash', balance: 50000, description: 'Primary cash register account', businessId: this.businessId, outletId: this.outletId, createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name: 'Bank Account', type: 'Bank', balance: 150000, description: 'Primary business bank account', businessId: this.businessId, outletId: this.outletId, createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name: 'Digital Payments', type: 'Digital', balance: 75000, description: 'UPI and card payment account', businessId: this.businessId, outletId: this.outletId, createdAt: new Date(), updatedAt: new Date() }
    ];
  }

  // Helper methods to get IDs from generated data
  getCategoryId(name) {
    const category = this.data.categories.find(c => c.name === name);
    return category ? category.id : null;
  }

  getProductTypeId(name) {
    const productType = this.data.productTypes.find(pt => pt.name === name);
    return productType ? productType.id : null;
  }

  getAreaId(name) {
    const area = this.data.areas.find(a => a.name === name);
    return area ? area.id : null;
  }

  // Main seeding method
  async seedDatabase() {
    try {
      console.log(`🔗 Executing transparent seeding for tenant: ${this.brandId}...`);
      
      const result = await neonTransactionSafeExecutor.executeWithTenant(this.brandId, async (transaction, context) => {
        const { transactionModels: models } = context;
        
        console.log('🏭 Models initialized via transaction context');
        console.log('🌱 Seeding database with complete cafe data...');
        
        // Insert data in proper order (respecting foreign keys)
        console.log('📝 Seeding categories...');
        await models.Category.bulkCreate(this.data.categories, { transaction });

        console.log('🥤 Seeding product types...');
        await models.ProductType.bulkCreate(this.data.productTypes, { transaction });

        console.log('🍽 Seeding products...');
        await models.Product.bulkCreate(this.data.products, { transaction });

        /*
        console.log('📦 Seeding inventory...');
        await models.InventoryItem.bulkCreate(this.data.inventory, { transaction });

        console.log('👥 Seeding staff...');
        await models.User.bulkCreate(this.data.staff, { transaction });

        console.log('🏢 Seeding areas...');
        await models.Area.bulkCreate(this.data.areas, { transaction });

        console.log('🪑 Seeding tables...');
        await models.Table.bulkCreate(this.data.tables, { transaction });

        console.log('⏰ Seeding operation timings...');
        await models.Timing.bulkCreate(this.data.operationTimings, { transaction });

        console.log('💰 Seeding expense types...');
        await models.ExpenseType.bulkCreate(this.data.expenseTypes, { transaction });

        console.log('🏦 Seeding accounts...');
        await models.Account.bulkCreate(this.data.accounts, { transaction });

        console.log('💰 Seeding transactions...');
        await models.Transaction.bulkCreate(this.data.transactions, { transaction });

        console.log('📋 Seeding orders...');
        await models.Order.bulkCreate(this.data.orders, { transaction });
        
        console.log('🍕 Seeding order items...');
        const orderItems = this.data.orders.flatMap(order => 
          order.items.map(item => ({
            ...item,
            orderId: order.id,
            businessId: this.businessId,
            outletId: this.outletId,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt
          }))
        );
        await models.OrderItem.bulkCreate(orderItems, { transaction });
        */
        
        return true;
        
        return true;
      });

      if (result.success) {
        console.log('✅ Database seeding completed successfully!');
        console.log('📊 Sample data summary:');
        console.log(`   - Categories: ${this.data.categories.length}`);
        console.log(`   - Product Types: ${this.data.productTypes.length}`);
        console.log(`   - Products: ${this.data.products.length}`);
        console.log(`   - Inventory Items: ${this.data.inventory.length}`);
        console.log(`   - Staff: ${this.data.staff.length}`);
        console.log(`   - Areas: ${this.data.areas.length}`);
        console.log(`   - Tables: ${this.data.tables.length}`);
        console.log(`   - Operation Timings: ${this.data.operationTimings.length}`);
        console.log(`   - Expense Types: ${this.data.expenseTypes.length}`);
        console.log(`   - Accounts: ${this.data.accounts.length}`);
        console.log(`   - Transactions: ${this.data.transactions.length}`);
        console.log(`   - Orders: ${this.data.orders.length}`);
      } else {
        throw new Error(result.error || 'Unknown seeding failure');
      }

    } catch (error) {
      console.error('❌ Error seeding database:', error);
      process.exit(1);
    }
  }
}

// Main execution
async function main() {
  const brandId = process.argv[2] || process.env.BRAND_ID || '5f1575c1-7b6f-44e4-a955-3fbf5c92fe20';
  const outletId = process.argv[3] || process.env.OUTLET_ID || uuidv4();
  
  console.log(`🌱 Starting cafe data seeding for Brand: ${brandId}, Outlet: ${outletId}`);
  
  const seeder = new CafeDataSeeder(brandId, outletId);
  seeder.generateCompleteCafeData();
  await seeder.seedDatabase();
}

if (require.main === module) {
  main();
}

module.exports = CafeDataSeeder;
