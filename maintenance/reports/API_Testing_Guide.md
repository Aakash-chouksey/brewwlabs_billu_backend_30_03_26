# 🚀 BrewwLabs POS API Testing Guide

## 📋 Setup Instructions

### 1. Import Collection
1. Open Postman
2. Click **Import** → Select **File**
3. Choose `BrewwLabs_POS_API_Collection.json`
4. Click **Import**

### 2. Import Environment
1. Click **Environments** → **Import**
2. Choose `BrewwLabs_POS_Postman_Environment.json`
3. Select **Development** environment
4. Click **Set as active**

### 3. Variables Explained
- `baseUrl`: API base URL (http://localhost:8000 for dev)
- `tenantToken`: JWT authentication token (set after login)
- `categoryId`, `productId`, etc.: Sample UUIDs for testing

---

## 🔐 Authentication Flow

### 1. Send OTP
```http
POST {{baseUrl}}/api/auth/send-otp
Content-Type: application/json

{
  "email": "test@example.com"
}
```

### 2. Verify OTP
```http
POST {{baseUrl}}/api/auth/verify-otp
Content-Type: application/json

{
  "email": "test@example.com",
  "otp": "123456"
}
```

### 3. Tenant Login
```http
POST {{baseUrl}}/api/tenant/login
Content-Type: application/json

{
  "email": "admin@tenant.com",
  "password": "Password123!"
}
```

**Response**: Copy the `token` value and set it as `tenantToken` variable

---

## 🏢 Business Onboarding

### Complete Business Registration
```http
POST {{baseUrl}}/api/onboarding/business
Content-Type: application/json

{
  "businessName": "Test Cafe",
  "businessEmail": "cafe@test.com",
  "businessPhone": "9876543210",
  "businessAddress": "123 Main St, City",
  "gstNumber": "123456789012345",
  "adminName": "Admin User",
  "adminEmail": "admin@test.com",
  "adminPassword": "Password123!"
}
```

---

## 👥 User Management

### Get Users
```http
GET {{baseUrl}}/api/tenant/users
Authorization: Bearer {{tenantToken}}
```

### Create User
```http
POST {{baseUrl}}/api/tenant/users
Authorization: Bearer {{tenantToken}}
Content-Type: application/json

{
  "name": "Test User",
  "email": "user@test.com",
  "password": "Password123!",
  "role": "STAFF",
  "phone": "9876543210"
}
```

---

## 📦 Category Management

### Get Categories
```http
GET {{baseUrl}}/api/tenant/categories
Authorization: Bearer {{tenantToken}}
```

### Create Category
```http
POST {{baseUrl}}/api/tenant/categories
Authorization: Bearer {{tenantToken}}
Content-Type: multipart/form-data

name: Beverages
color: #FF5733
image: [file]
```

### Update Category
```http
PUT {{baseUrl}}/api/tenant/categories/{{categoryId}}
Authorization: Bearer {{tenantToken}}
Content-Type: application/json

{
  "name": "Updated Category Name",
  "color": "#3B82F6"
}
```

### Delete Category
```http
DELETE {{baseUrl}}/api/tenant/categories/{{categoryId}}
Authorization: Bearer {{tenantToken}}
```

---

## 🍕 Product Management

### Get Products
```http
GET {{baseUrl}}/api/tenant/products
Authorization: Bearer {{tenantToken}}
```

### Create Product
```http
POST {{baseUrl}}/api/tenant/products
Authorization: Bearer {{tenantToken}}
Content-Type: multipart/form-data

name: Cappuccino
description: Rich espresso coffee with steamed milk foam
price: 120.00
categoryId: {{categoryId}}
image: [file]
```

### Update Product
```http
PUT {{baseUrl}}/api/tenant/products/{{productId}}
Authorization: Bearer {{tenantToken}}
Content-Type: application/json

{
  "name": "Updated Product Name",
  "price": 130.00
}
```

### Delete Product
```http
DELETE {{baseUrl}}/api/tenant/products/{{productId}}
Authorization: Bearer {{tenantToken}}
```

---

## 🪑 Table Management

### Get Tables
```http
GET {{baseUrl}}/api/tenant/tables
Authorization: Bearer {{tenantToken}}
```

### Create Table
```http
POST {{baseUrl}}/api/tenant/tables
Authorization: Bearer {{tenantToken}}
Content-Type: application/json

{
  "name": "Table 1",
  "tableNo": "T01",
  "capacity": 4,
  "areaId": "{{areaId}}",
  "shape": "square"
}
```

### Update Table
```http
PUT {{baseUrl}}/api/tenant/tables/{{tableId}}
Authorization: Bearer {{tenantToken}}
Content-Type: application/json

{
  "name": "Updated Table",
  "capacity": 6,
  "status": "Available"
}
```

### Delete Table
```http
DELETE {{baseUrl}}/api/tenant/tables/{{tableId}}
Authorization: Bearer {{tenantToken}}
```

---

## 🗺 Area Management

### Get Areas
```http
GET {{baseUrl}}/api/tenant/areas
Authorization: Bearer {{tenantToken}}
```

### Create Area
```http
POST {{baseUrl}}/api/tenant/areas
Authorization: Bearer {{tenantToken}}
Content-Type: application/json

{
  "name": "Main Dining Area",
  "description": "Primary dining space",
  "capacity": 50,
  "layout": "square"
}
```

### Update Area
```http
PUT {{baseUrl}}/api/tenant/areas/{{areaId}}
Authorization: Bearer {{tenantToken}}
Content-Type: application/json

{
  "name": "Updated Area Name",
  "capacity": 60
}
```

### Delete Area
```http
DELETE {{baseUrl}}/api/tenant/areas/{{areaId}}
Authorization: Bearer {{tenantToken}}
```

---

## 📋 Order Management

### Get Orders
```http
GET {{baseUrl}}/api/tenant/orders
Authorization: Bearer {{tenantToken}}
```

### Create Order
```http
POST {{baseUrl}}/api/tenant/orders
Authorization: Bearer {{tenantToken}}
Content-Type: application/json

{
  "tableId": "{{tableId}}",
  "items": [
    {
      "productId": "{{productId}}",
      "quantity": 2,
      "price": 120.00
    }
  ],
  "totalAmount": 240.00,
  "status": "ACTIVE"
}
```

### Get Order by ID
```http
GET {{baseUrl}}/api/tenant/orders/{{orderId}}
Authorization: Bearer {{tenantToken}}
```

### Update Order
```http
PUT {{baseUrl}}/api/tenant/orders/{{orderId}}
Authorization: Bearer {{tenantToken}}
Content-Type: application/json

{
  "status": "COMPLETED",
  "paymentStatus": "PAID"
}
```

---

## 📦 Inventory Management

### Get Inventory Items
```http
GET {{baseUrl}}/api/tenant/inventory/items
Authorization: Bearer {{tenantToken}}
```

### Create Inventory Item
```http
POST {{baseUrl}}/api/tenant/inventory/items
Authorization: Bearer {{tenantToken}}
Content-Type: application/json

{
  "name": "Coffee Beans",
  "description": "Premium Arabica beans",
  "quantity": 100,
  "unit": "kg",
  "price": 500.00,
  "lowStockThreshold": 20
}
```

### Update Inventory Item
```http
PUT {{baseUrl}}/api/tenant/inventory/items/{{itemId}}
Authorization: Bearer {{tenantToken}}
Content-Type: application/json

{
  "quantity": 150,
  "price": 550.00
}
```

### Get Low Stock Items
```http
GET {{baseUrl}}/api/tenant/inventory/low-stock
Authorization: Bearer {{tenantToken}}
```

### Add Stock Purchase
```http
POST {{baseUrl}}/api/tenant/inventory/purchase
Authorization: Bearer {{tenantToken}}
Content-Type: application/json

{
  "supplierId": "{{supplierId}}",
  "items": [
    {
      "productId": "{{productId}}",
      "quantity": 50,
      "unitPrice": 450.00
    }
  ],
  "totalAmount": 22500.00
}
```

---

## 👥 Customer Management

### Get Customers
```http
GET {{baseUrl}}/api/tenant/customers
Authorization: Bearer {{tenantToken}}
```

### Create Customer
```http
POST {{baseUrl}}/api/tenant/customers
Authorization: Bearer {{tenantToken}}
Content-Type: application/json

{
  "name": "John Doe",
  "phone": "9876543210",
  "email": "john@example.com",
  "address": "123 Main St"
}
```

### Get Customer by ID
```http
GET {{baseUrl}}/api/tenant/customers/{{customerId}}
Authorization: Bearer {{tenantToken}}
```

### Update Customer
```http
PUT {{baseUrl}}/api/tenant/customers/{{customerId}}
Authorization: Bearer {{tenantToken}}
Content-Type: application/json

{
  "name": "Jane Doe",
  "phone": "9876543211"
}
```

### Add Customer Due
```http
POST {{baseUrl}}/api/tenant/customers/{{customerId}}/add-due
Authorization: Bearer {{tenantToken}}
Content-Type: application/json

{
  "amount": 500.00,
  "description": "Food purchase"
}
```

### Customer Payment
```http
POST {{baseUrl}}/api/tenant/customers/{{customerId}}/pay
Authorization: Bearer {{tenantToken}}
Content-Type: application/json

{
  "amount": 300.00,
  "paymentMethod": "CASH",
  "description": "Partial payment"
}
```

### Get Customer Ledger
```http
GET {{baseUrl}}/api/tenant/customers/{{customerId}}/ledger
Authorization: Bearer {{tenantToken}}
```

---

## 💳 Payment Processing

### Create Payment Order
```http
POST {{baseUrl}}/api/tenant/payments/create-order
Authorization: Bearer {{tenantToken}}
Content-Type: application/json

{
  "amount": 240.00,
  "currency": "INR",
  "receipt": "Order #123"
}
```

### Verify Payment
```http
POST {{baseUrl}}/api/tenant/payments/verify
Authorization: Bearer {{tenantToken}}
Content-Type: application/json

{
  "razorpayOrderId": "order_12345",
  "razorpayPaymentId": "pay_12345",
  "razorpaySignature": "generated_signature"
}
```

---

## 📊 Reports & Analytics

### Get Sales Report
```http
GET {{baseUrl}}/api/tenant/reports/sales?startDate=2024-01-01&endDate=2024-01-31
Authorization: Bearer {{tenantToken}}
```

### Get Inventory Report
```http
GET {{baseUrl}}/api/tenant/reports/inventory
Authorization: Bearer {{tenantToken}}
```

### Get Dashboard Stats
```http
GET {{baseUrl}}/api/tenant/dashboard
Authorization: Bearer {{tenantToken}}
```

### Get Sales Analytics
```http
GET {{baseUrl}}/api/tenant/analytics/sales?period=30d
Authorization: Bearer {{tenantToken}}
```

---

## 🔧 System Health

### Health Check
```http
GET {{baseUrl}}/health
```

### Server Status
```http
GET {{baseUrl}}/
```

### Tenant System Health
```http
GET {{baseUrl}}/api/tenant/system-health
Authorization: Bearer {{tenantToken}}
```

---

## 🎯 Testing Workflow

### 1. Basic Flow Test
1. **Health Check** → Verify server is running
2. **Business Onboarding** → Create new business
3. **Login** → Authenticate as tenant admin
4. **Create Category** → Add product category
5. **Create Product** → Add product to category
6. **Create Table** → Add dining table
7. **Create Order** → Place test order
8. **Create Customer** → Add customer record

### 2. Advanced Flow Test
1. **Inventory Management** → Add stock items
2. **Customer Ledger** → Check customer transactions
3. **Reports** → Generate sales reports
4. **Analytics** → Check business analytics
5. **Payment Flow** → Test payment processing

### 3. Error Scenarios Test
1. **Invalid Auth** → Test with wrong credentials
2. **Missing Headers** → Remove Authorization header
3. **Invalid Data** → Send malformed JSON
4. **Unauthorized Access** → Access other tenant data
5. **Rate Limiting** → Test API rate limits

---

## 📝 Response Formats

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

---

## 🔍 Debugging Tips

### Common Issues
1. **401 Unauthorized**: Check `tenantToken` variable is set correctly
2. **403 Forbidden**: Verify user has required permissions
3. **404 Not Found**: Check endpoint URL and resource IDs
4. **422 Validation Error**: Check request body format
5. **500 Server Error**: Check server logs for details

### Headers Required
- `Authorization: Bearer {{tenantToken}}` for all authenticated endpoints
- `Content-Type: application/json` for JSON payloads
- `Content-Type: multipart/form-data` for file uploads

### Variables Update
After successful login, update the `tenantToken` variable:
1. Go to **Environments** → **Development**
2. Find `tenantToken` in **Current Value** column
3. Click **Edit** → Paste new token value
4. Click **Save**

---

## 🚨 Security Notes

### Testing Best Practices
1. Use test credentials only in development
2. Never commit real credentials to version control
3. Test rate limiting and error handling
4. Verify tenant isolation works correctly
5. Test file upload security

### Production Considerations
1. Use HTTPS in production environment
2. Implement proper authentication flow
3. Test with production SSL certificates
4. Monitor API performance and errors
5. Set up proper logging and monitoring

---

## 📞 Support

If you encounter issues:
1. Check server logs: `tail -f server.log`
2. Verify database connections: Check PostgreSQL status
3. Test Redis connection: Check Redis status
4. Review middleware logs: Check authentication flow
5. Validate environment variables: Check .env configuration

**Happy Testing! 🎉**
