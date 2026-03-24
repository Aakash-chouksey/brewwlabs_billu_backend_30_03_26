require('dotenv').config();

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/brewwlabs_test';

// Mock database connection for tests
global.testDb = {
  query: jest.fn(),
  close: jest.fn()
};

// Mock Razorpay
jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => ({
    orders: {
      create: jest.fn().mockResolvedValue({ id: 'test_order_123', amount: 50000 }),
      fetch: jest.fn().mockResolvedValue({ id: 'test_order_123', status: 'created' })
    },
    payments: {
      fetch: jest.fn().mockResolvedValue({ status: 'captured' })
    }
  }));
});

// Mock AWS S3
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({})),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn()
}));

// Global test timeout
jest.setTimeout(30000);

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Global test data
global.testData = {
  user: {
    id: 'test-user-123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'admin'
  },
  outlet: {
    id: 'outlet-123',
    name: 'Test Cafe',
    status: 'active'
  },
  order: {
    id: 'order-123',
    status: 'pending',
    items: [
      { productId: 'prod-1', name: 'Coffee', quantity: 2, price: 150 }
    ],
    total: 300
  },
  product: {
    id: 'prod-1',
    name: 'Coffee',
    price: 150,
    category: 'beverages',
    inStock: true
  },
  payment: {
    orderId: 'order-123',
    amount: 30000,
    method: 'razorpay',
    status: 'completed'
  }
};

console.log('Test environment initialized');
