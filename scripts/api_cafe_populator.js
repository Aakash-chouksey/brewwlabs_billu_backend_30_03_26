#!/usr/bin/env node

/**
 * API-BASED CAFE DATA POPULATOR
 * 
 * This script populates the database with realistic cafe data
 * by calling the existing API endpoints.
 * 
 * Usage: node scripts/api_cafe_populator.js
 */

require('dotenv').config();
const axios = require('axios');

// API base URL
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000/api';

// Authentication token (you may need to update this)
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'your-auth-token-here';

// Brand and Outlet IDs
const BRAND_ID = process.argv[2] || process.env.BRAND_ID || '5f1575c1-7b6f-44e4-a955-3fbf5c92fe20';
const OUTLET_ID = process.argv[3] || process.env.OUTLET_ID || 'default-outlet-id';

// Axios instance with auth
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

// Sample data generator
const generateCafeData = () => {
  console.log('🌱 Generating cafe dataset...');
  
  return {
    categories: [
      { name: 'Beverages', description: 'Hot and cold drinks', color: '#3B82F6' },
      { name: 'Food', description: 'Main course items', color: '#10B981' },
      { name: 'Desserts', description: 'Sweet treats', color: '#F59E0B' },
      { name: 'Snacks', description: 'Light bites', color: '#EF4444' }
    ],

    productTypes: [
      { name: 'Coffee', description: 'Various coffee preparations', icon: '☕' },
      { name: 'Tea', description: 'Tea varieties', icon: '🍵' },
      { name: 'Juice', description: 'Fresh juices', icon: '🧃' },
      { name: 'Sandwich', description: 'Fresh sandwiches', icon: '🥪' }
    ],

    products: [
      { name: 'Espresso', price: 80, description: 'Strong black coffee', categoryId: 1, productTypeId: 1, isAvailable: true },
      { name: 'Cappuccino', price: 120, description: 'Espresso with steamed milk', categoryId: 1, productTypeId: 1, isAvailable: true },
      { name: 'Latte', price: 140, description: 'Espresso with lots of milk', categoryId: 1, productTypeId: 1, isAvailable: true },
      { name: 'Green Tea', price: 60, description: 'Fresh green tea', categoryId: 1, productTypeId: 2, isAvailable: true },
      { name: 'Orange Juice', price: 100, description: 'Fresh orange juice', categoryId: 1, productTypeId: 3, isAvailable: true },
      { name: 'Club Sandwich', price: 180, description: 'Triple decker club sandwich', categoryId: 2, productTypeId: 4, isAvailable: true },
      { name: 'Chocolate Cake', price: 120, description: 'Rich chocolate cake', categoryId: 3, productTypeId: 4, isAvailable: true }
    ],

    inventory: [
      { name: 'Coffee Beans', category: 'Raw Materials', stock: 50, unit: 'kg', price: 500, minStock: 10 },
      { name: 'Milk', category: 'Dairy', stock: 20, unit: 'liters', price: 60, minStock: 5 },
      { name: 'Sugar', category: 'Raw Materials', stock: 100, unit: 'kg', price: 40, minStock: 10 },
      { name: 'Bread', category: 'Bakery', stock: 30, unit: 'pieces', price: 20, minStock: 10 },
      { name: 'Cheese', category: 'Dairy', stock: 15, unit: 'kg', price: 400, minStock: 5 }
    ],

    areas: [
      { name: 'Indoor Seating', description: 'Main dining area', capacity: 24 },
      { name: 'Outdoor Patio', description: 'Outdoor seating area', capacity: 16 },
      { name: 'Private Dining', description: 'Private event space', capacity: 20 }
    ],

    tables: [
      { name: 'Table 1', tableNo: 'T001', capacity: 4, areaId: 1, status: 'Available' },
      { name: 'Table 2', tableNo: 'T002', capacity: 4, areaId: 1, status: 'Available' },
      { name: 'Table 3', tableNo: 'T003', capacity: 6, areaId: 1, status: 'Available' },
      { name: 'Table 4', tableNo: 'T004', capacity: 2, areaId: 2, status: 'Available' },
      { name: 'Table 5', tableNo: 'T005', capacity: 2, areaId: 2, status: 'Available' },
      { name: 'Table 6', tableNo: 'T006', capacity: 8, areaId: 3, status: 'Available' },
      { name: 'Table 7', tableNo: 'T007', capacity: 8, areaId: 3, status: 'Available' }
    ],

    operationTimings: [
      { day: 'Monday', isOpen: true, openTime: '08:00', closeTime: '23:00', breakStart: '15:00', breakEnd: '16:00', specialNotes: 'Regular hours' },
      { day: 'Tuesday', isOpen: true, openTime: '08:00', closeTime: '23:00', breakStart: '15:00', breakEnd: '16:00', specialNotes: 'Regular hours' },
      { day: 'Wednesday', isOpen: true, openTime: '08:00', closeTime: '23:00', breakStart: '15:00', breakEnd: '16:00', specialNotes: 'Regular hours' },
      { day: 'Thursday', isOpen: true, openTime: '08:00', closeTime: '23:00', breakStart: '15:00', breakEnd: '16:00', specialNotes: 'Regular hours' },
      { day: 'Friday', isOpen: true, openTime: '08:00', closeTime: '00:00', breakStart: '15:00', breakEnd: '16:00', specialNotes: 'Extended hours' },
      { day: 'Saturday', isOpen: true, openTime: '09:00', closeTime: '00:00', breakStart: '16:00', breakEnd: '17:00', specialNotes: 'Weekend schedule' },
      { day: 'Sunday', isOpen: true, openTime: '09:00', closeTime: '23:00', breakStart: null, breakEnd: null, specialNotes: 'Weekend schedule' }
    ],

    transactions: [
      { type: 'Income', category: 'Food Sales', amount: 15000, description: 'Daily food sales revenue' },
      { type: 'Income', category: 'Beverage Sales', amount: 8000, description: 'Daily beverage sales revenue' },
      { type: 'Income', category: 'Dessert Sales', amount: 3000, description: 'Daily dessert sales revenue' },
      { type: 'Expense', category: 'Raw Materials', amount: 5000, description: 'Daily raw material purchase' },
      { type: 'Expense', category: 'Utilities', amount: 1500, description: 'Daily electricity bill' },
      { type: 'Expense', category: 'Salaries', amount: 8000, description: 'Daily staff wages' }
    ]
  };
};

// API helper functions
const apiCall = async (method, endpoint, data = null) => {
  try {
    console.log(`📡 ${method.toUpperCase()} ${endpoint}`);
    const response = await api[method](endpoint, data);
    console.log(`✅ ${method.toUpperCase()} ${endpoint} - Status: ${response.status}`);
    return response.data;
  } catch (error) {
    console.error(`❌ ${method.toUpperCase()} ${endpoint} - Error:`, error.response?.data || error.message);
    throw error;
  }
};

// Main populator function
const populateDatabase = async () => {
  try {
    console.log('🌱 Starting cafe data population...');
    console.log(`🏢 Brand ID: ${BRAND_ID}, Outlet ID: ${OUTLET_ID}`);
    
    const data = generateCafeData();

    // Populate Categories
    console.log('📝 Populating categories...');
    for (const category of data.categories) {
      await apiCall('post', '/tenant/categories', category);
    }

    // Populate Product Types
    console.log('🥤 Populating product types...');
    for (const productType of data.productTypes) {
      await apiCall('post', '/tenant/product-types', productType);
    }

    // Populate Products
    console.log('🍽 Populating products...');
    for (const product of data.products) {
      await apiCall('post', '/tenant/products', product);
    }

    // Populate Inventory
    console.log('📦 Populating inventory...');
    for (const item of data.inventory) {
      await apiCall('post', '/tenant/inventory', item);
    }

    // Populate Areas
    console.log('🏢 Populating areas...');
    for (const area of data.areas) {
      await apiCall('post', '/tenant/areas', area);
    }

    // Populate Tables
    console.log('🪑 Populating tables...');
    for (const table of data.tables) {
      await apiCall('post', '/tenant/tables', table);
    }

    // Populate Operation Timings
    console.log('⏰ Populating operation timings...');
    for (const timing of data.operationTimings) {
      await apiCall('post', '/tenant/operation-timings', timing);
    }

    // Populate Transactions
    console.log('💰 Populating transactions...');
    for (const transaction of data.transactions) {
      await apiCall('post', '/tenant/transactions', transaction);
    }

    console.log('✅ Database population completed successfully!');
    console.log('📊 Data summary:');
    console.log(`   - Categories: ${data.categories.length}`);
    console.log(`   - Product Types: ${data.productTypes.length}`);
    console.log(`   - Products: ${data.products.length}`);
    console.log(`   - Inventory Items: ${data.inventory.length}`);
    console.log(`   - Areas: ${data.areas.length}`);
    console.log(`   - Tables: ${data.tables.length}`);
    console.log(`   - Operation Timings: ${data.operationTimings.length}`);
    console.log(`   - Transactions: ${data.transactions.length}`);

    console.log('🎉 Admin screens should now show proper data from database!');

  } catch (error) {
    console.error('❌ Error populating database:', error.message);
    process.exit(1);
  }
};

// Run the populator
if (require.main === module) {
  populateDatabase();
}

module.exports = { generateCafeData, populateDatabase };
