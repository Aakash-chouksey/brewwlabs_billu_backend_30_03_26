/**
 * Test Script for Item Creation Issues
 * This script tests various scenarios to identify why items are not being added
 */

const axios = require('axios');

// Configuration - adjust these based on your setup
const BASE_URL = 'http://localhost:8000';
const TEST_CREDENTIALS = {
  email: 'hhhh@gmail.com',
  password: 'Password@123'
};

let authToken = '';
let selectedOutlet = null;

async function login() {
  try {
    console.log('🔐 Logging in...');
    const response = await axios.post(`${BASE_URL}/api/auth/login`, TEST_CREDENTIALS);
    authToken = response.data.token;
    console.log('✅ Login successful');
    
    // Get outlets
    const outletsResponse = await axios.get(`${BASE_URL}/api/tenant/outlets`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (outletsResponse.data.data && outletsResponse.data.data.length > 0) {
      selectedOutlet = outletsResponse.data.data[0];
      console.log(`📍 Selected outlet: ${selectedOutlet.name}`);
    } else {
      throw new Error('No outlets found');
    }
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testCategoryCreation() {
  try {
    console.log('\n🧪 Testing Category Creation...');
    
    const categoryData = {
      name: `Test Category ${Date.now()}`,
      description: 'Test category for debugging',
      color: '#3B82F6',
      isEnabled: true
    };
    
    console.log('📤 Sending category data:', categoryData);
    
    const response = await axios.post(
      `${BASE_URL}/api/tenant/categories`,
      categoryData,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'x-outlet-id': selectedOutlet.id,
          'x-business-id': selectedOutlet.businessId
        }
      }
    );
    
    console.log('✅ Category created successfully:', response.data.data.id);
    return response.data.data;
  } catch (error) {
    console.error('❌ Category creation failed:');
    console.error('  - Status:', error.response?.status);
    console.error('  - Data:', error.response?.data);
    console.error('  - Message:', error.response?.data?.message || error.message);
    return null;
  }
}

async function testProductCreation(categoryId) {
  try {
    console.log('\n🧪 Testing Product Creation...');
    
    const productData = {
      name: `Test Product ${Date.now()}`,
      categoryId: categoryId,
      price: 99.99,
      description: 'Test product for debugging',
      isAvailable: true,
      currentStock: 10
    };
    
    console.log('📤 Sending product data:', productData);
    
    const response = await axios.post(
      `${BASE_URL}/api/tenant/products`,
      productData,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'x-outlet-id': selectedOutlet.id,
          'x-business-id': selectedOutlet.businessId
        }
      }
    );
    
    console.log('✅ Product created successfully:', response.data.data.id);
    return response.data.data;
  } catch (error) {
    console.error('❌ Product creation failed:');
    console.error('  - Status:', error.response?.status);
    console.error('  - Data:', error.response?.data);
    console.error('  - Message:', error.response?.data?.message || error.message);
    return null;
  }
}

async function testInventoryItemCreation() {
  try {
    console.log('\n🧪 Testing Inventory Item Creation...');
    
    const inventoryData = {
      name: `Test Inventory Item ${Date.now()}`,
      currentStock: 50,
      minimumStock: 5,
      unit: 'pcs',
      costPerUnit: 10.00,
      sku: `TEST-${Date.now()}`,
      description: 'Test inventory item for debugging'
    };
    
    console.log('📤 Sending inventory data:', inventoryData);
    
    const response = await axios.post(
      `${BASE_URL}/api/tenant/inventory/items`,
      inventoryData,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'x-outlet-id': selectedOutlet.id,
          'x-business-id': selectedOutlet.businessId
        }
      }
    );
    
    console.log('✅ Inventory item created successfully:', response.data.data.id);
    return response.data.data;
  } catch (error) {
    console.error('❌ Inventory item creation failed:');
    console.error('  - Status:', error.response?.status);
    console.error('  - Data:', error.response?.data);
    console.error('  - Message:', error.response?.data?.message || error.message);
    return null;
  }
}

async function testDuplicateItemCreation(categoryId) {
  try {
    console.log('\n🧪 Testing Duplicate Item Creation (should fail)...');
    
    const productData = {
      name: 'Duplicate Test Product',
      categoryId: categoryId,
      price: 99.99,
      description: 'Test duplicate product',
      isAvailable: true,
      currentStock: 10
    };
    
    // First creation
    console.log('📤 Creating first item...');
    const response1 = await axios.post(
      `${BASE_URL}/api/tenant/products`,
      productData,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'x-outlet-id': selectedOutlet.id,
          'x-business-id': selectedOutlet.businessId
        }
      }
    );
    
    console.log('✅ First item created:', response1.data.data.id);
    
    // Second creation (should fail)
    console.log('📤 Creating duplicate item...');
    try {
      const response2 = await axios.post(
        `${BASE_URL}/api/tenant/products`,
        productData,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'x-outlet-id': selectedOutlet.id,
            'x-business-id': selectedOutlet.businessId
          }
        }
      );
      
      console.log('⚠️ Duplicate item creation succeeded (this might be an issue):', response2.data.data.id);
    } catch (duplicateError) {
      console.log('✅ Duplicate item creation correctly failed:', duplicateError.response?.data?.message);
    }
    
  } catch (error) {
    console.error('❌ Duplicate test failed:', error.response?.data || error.message);
  }
}

async function checkExistingData() {
  try {
    console.log('\n📊 Checking Existing Data...');
    
    // Check categories
    const categoriesResponse = await axios.get(`${BASE_URL}/api/tenant/categories`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'x-outlet-id': selectedOutlet.id,
        'x-business-id': selectedOutlet.businessId
      }
    });
    
    console.log(`📁 Categories: ${categoriesResponse.data.data?.length || 0} items`);
    categoriesResponse.data.data?.forEach(cat => {
      console.log(`  - ${cat.name} (${cat.id})`);
    });
    
    // Check products
    const productsResponse = await axios.get(`${BASE_URL}/api/tenant/products`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'x-outlet-id': selectedOutlet.id,
        'x-business-id': selectedOutlet.businessId
      }
    });
    
    console.log(`📦 Products: ${productsResponse.data.data?.length || 0} items`);
    productsResponse.data.data?.forEach(prod => {
      console.log(`  - ${prod.name} (${prod.id}) - Category: ${prod.categoryId}`);
    });
    
    // Check inventory items
    const inventoryResponse = await axios.get(`${BASE_URL}/api/tenant/inventory/items`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'x-outlet-id': selectedOutlet.id,
        'x-business-id': selectedOutlet.businessId
      }
    });
    
    console.log(`📋 Inventory Items: ${inventoryResponse.data.data?.length || 0} items`);
    inventoryResponse.data.data?.forEach(item => {
      console.log(`  - ${item.name} (${item.id}) - Stock: ${item.currentStock}`);
    });
    
  } catch (error) {
    console.error('❌ Data check failed:', error.response?.data || error.message);
  }
}

async function runTests() {
  try {
    console.log('🚀 Starting Item Creation Tests...\n');
    
    // Login and setup
    await login();
    
    // Check existing data
    await checkExistingData();
    
    // Test category creation
    const category = await testCategoryCreation();
    
    if (category) {
      // Test product creation
      const product = await testProductCreation(category.id);
      
      // Test duplicate creation
      await testDuplicateItemCreation(category.id);
    }
    
    // Test inventory item creation
    await testInventoryItemCreation();
    
    // Final data check
    await checkExistingData();
    
    console.log('\n✅ All tests completed!');
    
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
  }
}

// Run the tests
runTests().catch(console.error);
