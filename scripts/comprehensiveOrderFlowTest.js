/**
 * COMPREHENSIVE ORDER FLOW TEST
 * Tests the complete order lifecycle to verify all fixes are working
 */

const axios = require('axios');

// Configuration
const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000/api';
const TEST_BUSINESS_ID = 'debug-business';
const TEST_OUTLET_ID = 'debug-outlet';

// Test credentials (adjust based on your setup)
const TEST_CREDENTIALS = {
  phone: '9999999999',
  otp: '123456'
};

let authToken = null;
let testOrderId = null;
let testTableId = null;

// HTTP client with auth
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
    'x-outlet-id': TEST_OUTLET_ID,
    'x-business-id': TEST_BUSINESS_ID
  }
});

async function login() {
  console.log('🔐 Logging in...');
  try {
    const response = await api.post('/auth/verify-otp', TEST_CREDENTIALS);
    authToken = response.data.data.token;
    api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
    console.log('✅ Login successful');
    return true;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    return false;
  }
}

async function getTables() {
  console.log('🪑 Getting available tables...');
  try {
    const response = await api.get('/tenant/tables');
    const tables = response.data.data;
    const availableTable = tables.find(t => t.status === 'AVAILABLE');
    
    if (availableTable) {
      testTableId = availableTable.id;
      console.log(`✅ Found available table: ${availableTable.name} (ID: ${testTableId})`);
      return availableTable;
    } else {
      console.log('⚠️ No available tables found');
      return null;
    }
  } catch (error) {
    console.error('❌ Failed to get tables:', error.response?.data || error.message);
    return null;
  }
}

async function createOrder() {
  console.log('📦 Creating test order...');
  try {
    const orderData = {
      tableId: testTableId,
      type: 'DINE_IN',
      customerId: null,
      items: [
        {
          productId: 'test-product-1',
          quantity: 2,
          notes: 'Test order item 1'
        },
        {
          productId: 'test-product-2', 
          quantity: 1,
          notes: 'Test order item 2'
        }
      ],
      notes: 'Test order from comprehensive flow test'
    };

    const response = await api.post('/tenant/orders', orderData);
    testOrderId = response.data.data.id;
    
    console.log(`✅ Order created successfully`);
    console.log(`   Order ID: ${testOrderId}`);
    console.log(`   Order Number: ${response.data.data.orderNumber}`);
    console.log(`   Status: ${response.data.data.status}`);
    console.log(`   Table ID: ${response.data.data.tableId}`);
    
    return response.data.data;
  } catch (error) {
    console.error('❌ Failed to create order:', error.response?.data || error.message);
    return null;
  }
}

async function checkLiveOrders() {
  console.log('🔍 Checking Live Orders API...');
  try {
    const response = await api.get('/tenant/live-orders');
    const orders = response.data.data;
    
    console.log(`✅ Live Orders API returned ${orders.length} orders`);
    
    const testOrder = orders.find(o => o.id === testOrderId);
    if (testOrder) {
      console.log(`✅ Test order found in live orders!`);
      console.log(`   Status: ${testOrder.status}`);
      console.log(`   Table: ${testOrder.table?.name || 'N/A'}`);
      return true;
    } else {
      console.log(`❌ Test order NOT found in live orders`);
      console.log(`   Available orders: ${orders.map(o => `${o.id} (${o.status})`).join(', ')}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Failed to check live orders:', error.response?.data || error.message);
    return false;
  }
}

async function checkKitchenOrders() {
  console.log('🍳 Checking Kitchen Orders API...');
  try {
    const response = await api.get('/tenant/kitchen/orders');
    const orders = response.data.data;
    
    console.log(`✅ Kitchen Orders API returned ${orders.length} orders`);
    
    const testOrder = orders.find(o => o.id === testOrderId);
    if (testOrder) {
      console.log(`✅ Test order found in kitchen orders!`);
      console.log(`   Status: ${testOrder.status}`);
      console.log(`   Table: ${testOrder.table?.name || 'N/A'}`);
      return true;
    } else {
      console.log(`❌ Test order NOT found in kitchen orders`);
      console.log(`   Available orders: ${orders.map(o => `${o.id} (${o.status})`).join(', ')}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Failed to check kitchen orders:', error.response?.data || error.message);
    return false;
  }
}

async function checkTableStatus() {
  console.log('🪑 Checking table status...');
  try {
    const response = await api.get('/tenant/tables');
    const tables = response.data.data;
    const testTable = tables.find(t => t.id === testTableId);
    
    if (testTable) {
      console.log(`✅ Table status: ${testTable.status}`);
      console.log(`   Current Order ID: ${testTable.currentOrderId}`);
      
      if (testTable.status === 'OCCUPIED' && testTable.currentOrderId === testOrderId) {
        console.log(`✅ Table correctly marked as OCCUPIED with correct order`);
        return true;
      } else {
        console.log(`❌ Table status mismatch. Expected: OCCUPIED with order ${testOrderId}`);
        return false;
      }
    } else {
      console.log(`❌ Test table not found`);
      return false;
    }
  } catch (error) {
    console.error('❌ Failed to check table status:', error.response?.data || error.message);
    return false;
  }
}

async function updateKitchenOrderStatus() {
  console.log('🔄 Testing kitchen order status update...');
  try {
    const response = await api.put(`/tenant/kitchen/orders/${testOrderId}/status`, {
      status: 'IN_PROGRESS'
    });
    
    console.log(`✅ Order status updated to: ${response.data.data.status}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to update kitchen order status:', error.response?.data || error.message);
    return false;
  }
}

async function cleanup() {
  console.log('🧹 Cleaning up test order...');
  try {
    await api.put(`/tenant/orders/${testOrderId}`, {
      status: 'CANCELLED'
    });
    
    // Reset table status
    await api.put(`/tenant/tables/${testTableId}`, {
      status: 'AVAILABLE',
      currentOrderId: null
    });
    
    console.log('✅ Cleanup completed');
  } catch (error) {
    console.error('⚠️ Cleanup failed:', error.response?.data || error.message);
  }
}

async function runComprehensiveTest() {
  console.log('🚀 Starting Comprehensive Order Flow Test\n');
  
  const results = {
    login: false,
    getTables: false,
    createOrder: false,
    liveOrders: false,
    kitchenOrders: false,
    tableStatus: false,
    statusUpdate: false
  };

  try {
    // Step 1: Login
    results.login = await login();
    if (!results.login) {
      console.log('\n❌ Test aborted: Login failed');
      return;
    }

    // Step 2: Get available table
    results.getTables = await getTables();
    if (!results.getTables || !testTableId) {
      console.log('\n❌ Test aborted: No available table');
      return;
    }

    // Step 3: Create order
    const order = await createOrder();
    results.createOrder = !!order;
    if (!results.createOrder) {
      console.log('\n❌ Test aborted: Order creation failed');
      return;
    }

    // Wait a moment for real-time updates
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 4: Check live orders
    results.liveOrders = await checkLiveOrders();

    // Step 5: Check kitchen orders
    results.kitchenOrders = await checkKitchenOrders();

    // Step 6: Check table status
    results.tableStatus = await checkTableStatus();

    // Step 7: Test kitchen status update
    results.statusUpdate = await updateKitchenOrderStatus();

  } catch (error) {
    console.error('🚨 Unexpected error during test:', error.message);
  } finally {
    // Cleanup
    if (testOrderId) {
      await cleanup();
    }
  }

  // Results Summary
  console.log('\n📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(50));
  
  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${test.replace(/([A-Z])/g, ' $1').toUpperCase()}`);
  });

  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  console.log('='.repeat(50));
  console.log(`🎯 Overall Result: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 ALL TESTS PASSED! The order lifecycle is working correctly.');
  } else {
    console.log('⚠️ Some tests failed. Please review the issues above.');
  }
}

// Run the test
if (require.main === module) {
  runComprehensiveTest().catch(console.error);
}

module.exports = { runComprehensiveTest };
