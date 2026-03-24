# POS Backend - Multi-Tenant SaaS Platform

A comprehensive multi-tenant Point of Sale (POS) backend system built with Node.js, Express, PostgreSQL, and Sequelize. This platform provides strict tenant isolation with database-per-tenant architecture, supporting restaurants, retail stores, and service businesses.

## 🏗️ Architecture

### Multi-Tenant Design
- **Database-per-Tenant**: Each tenant gets their own isolated PostgreSQL database
- **Control Plane**: Central database for platform metadata (brands, subscriptions, connections)
- **Tenant Plane**: Individual databases for business operations
- **Connection Pooling**: LRU cache for efficient database connection management
- **Strict Isolation**: Tenant-scoped models with automatic filtering

### Core Components
- **Tenant Provisioning Service**: Automated tenant onboarding with database creation
- **Authentication & Authorization**: JWT-based auth with role-based access control
- **Outlet Scoping**: Multi-location support with per-outlet data isolation
- **Real-time Features**: Socket.io for live updates
- **Audit Logging**: Comprehensive activity tracking
- **Analytics Dashboard**: Business intelligence and reporting

## 🚀 Features

### Business Operations
- **Multi-Outlet Management**: Support for chains and franchises
- **Product Catalog**: Categories, variants, modifiers, and inventory
- **Order Management**: Complete order lifecycle with status tracking
- **Payment Processing**: Multiple payment methods with refund support
- **Customer Management**: Loyalty programs and customer profiles
- **Inventory Tracking**: Stock levels, suppliers, and purchase orders
- **Financial Management**: Expenses, cash register sessions, reporting

### Platform Features
- **Subscription Management**: Tiered plans with feature limits
- **Franchise Hierarchy**: Multi-level brand structure
- **Cluster Management**: Scalable database distribution
- **Security**: Rate limiting, CORS, input validation
- **Monitoring**: Health checks, performance metrics
- **API Documentation**: RESTful API with comprehensive testing

## 📋 Requirements

- Node.js >= 18.0.0
- PostgreSQL >= 13.0
- Redis (for caching and sessions)
- npm >= 8.0.0

## 🛠️ Installation

### 1. Clone Repository
```bash
git clone https://github.com/your-org/pos-backend.git
cd pos-backend
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 4. Database Setup
```bash
# Create control plane database
createdb pos_control_plane

# Run control plane migrations
npm run migrate:control-plane

# Seed control plane data
npm run seed:control-plane
```

### 5. Start Development Server
```bash
npm run dev
```

## ⚙️ Configuration

### Environment Variables

```env
# Control Plane Database
CONTROL_PLANE_DATABASE_URL=postgresql://user:password@localhost:5432/pos_control_plane

# Tenant Database Configuration
DEFAULT_DB_HOST=localhost
DEFAULT_DB_PORT=5432
DEFAULT_DB_USER=postgres
DEFAULT_DB_PASSWORD=password

# Application
NODE_ENV=development
PORT=3000
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# Connection Pooling
MAX_ACTIVE_TENANTS=100
TENANT_POOL_MAX=2

# Redis (Optional)
REDIS_URL=redis://localhost:6379

# Email (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# File Storage (Optional)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name
```

## 🏢 Database Schema

### Control Plane Tables
- `brands` - Business/brand information with franchise hierarchy
- `tenant_connections` - Database connection details for each tenant
- `subscriptions` - Subscription plans and billing
- `plans` - Available subscription tiers
- `super_admin_users` - Platform administrators
- `cluster_metadata` - Database cluster information
- `tenant_migration_log` - Migration tracking

### Tenant Tables (45+ tables)
- **Core**: `outlets`, `users`, `user_outlets`, `roles`, `terminals`
- **Menu**: `categories`, `products`, `product_variants`, `modifiers`
- **Orders**: `orders`, `order_items`, `order_item_modifiers`, `order_status_history`
- **Payments**: `payments`, `refunds`, `payment_methods`
- **Inventory**: `inventory_items`, `inventory_transactions`, `suppliers`, `purchases`
- **Customers**: `customers`, `loyalty_accounts`, `loyalty_transactions`
- **Analytics**: `daily_sales_summary`, `product_sales_summary`
- **Logs**: `audit_logs`, `system_logs`
- **Notifications**: `notifications`, `notification_templates`

## 🔐 Security

### Tenant Isolation
- **Database Separation**: Each tenant has isolated database
- **Connection Security**: Encrypted database credentials
- **Model Hooks**: Automatic tenant filtering on all queries
- **API Security**: Tenant validation on all requests

### Authentication & Authorization
- **JWT Tokens**: Secure token-based authentication
- **Role-Based Access**: Granular permissions system
- **Outlet Scoping**: Users access only assigned outlets
- **Rate Limiting**: Prevent abuse and DDoS attacks

### Data Protection
- **Input Validation**: Comprehensive request validation
- **SQL Injection Prevention**: Parameterized queries
- **XSS Protection**: Output sanitization
- **CORS Configuration**: Proper cross-origin settings

## 🧪 Testing

### Run All Tests
```bash
npm test
```

### Test Categories
```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# Security tests
npm run test:security

# Coverage report
npm run test:coverage
```

### Test Suites
- **Tenant Isolation**: Verify data separation between tenants
- **Order & Payment Flow**: Complete transaction testing
- **Security**: Authentication, authorization, and vulnerability testing
- **API Endpoints**: Request/response validation
- **Database**: Migration and connection testing

## 📊 API Documentation

### Authentication Endpoints
```
POST /api/auth/register     - User registration
POST /api/auth/login        - User login
POST /api/auth/logout       - User logout
GET  /api/auth/profile      - User profile
```

### Tenant Endpoints
```
GET    /api/tenant/outlets           - List outlets
POST   /api/tenant/outlets           - Create outlet
GET    /api/tenant/products          - List products
POST   /api/tenant/products          - Create product
GET    /api/tenant/orders            - List orders
POST   /api/tenant/orders            - Create order
GET    /api/tenant/payments          - List payments
POST   /api/tenant/payments          - Create payment
```

### Admin Endpoints
```
GET    /api/admin/tenants            - List tenants
POST   /api/admin/tenants            - Provision tenant
GET    /api/admin/tenants/:id        - Get tenant details
PUT    /api/admin/tenants/:id/status - Update tenant status
DELETE /api/admin/tenants/:id        - Deactivate tenant
```

## 🚀 Deployment

### Production Setup
```bash
# Install production dependencies
npm ci --production

# Run control plane migrations
npm run migrate:control-plane

# Start production server
npm start
```

### Docker Deployment
```bash
# Build image
npm run docker:build

# Run container
npm run docker:run
```

### Environment Configuration
- Set `NODE_ENV=production`
- Use strong JWT secrets
- Configure proper database URLs
- Set up SSL certificates
- Configure monitoring and logging

## 📈 Monitoring & Logging

### Application Logs
- **Winston**: Structured logging with daily rotation
- **Log Levels**: debug, info, warn, error, fatal
- **Tenant Context**: All logs include tenant information
- **Security Events**: Authentication failures, access violations

### Health Checks
- **Database Connectivity**: Connection pool monitoring
- **Tenant Health**: Individual tenant status checks
- **Performance Metrics**: Response times, error rates
- **Resource Usage**: Memory, CPU, database connections

### Analytics
- **Business Metrics**: Sales, orders, customer activity
- **System Metrics**: API usage, error tracking
- **Tenant Analytics**: Per-tenant usage statistics
- **Performance Monitoring**: Query optimization insights

## 🔄 Migrations

### Control Plane Migrations
```bash
# Run control plane migrations
npm run migrate:control-plane

# Create new migration
npx sequelize-cli migration:generate --name control_plane_update
```

### Tenant Migrations
```bash
# Run migrations for specific tenant
npm run migrate:tenant -- --tenant-id=tenant-uuid

# Run migrations for all tenants
npm run migrate:tenant -- --all
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow ESLint configuration
- Write comprehensive tests
- Update documentation
- Use conventional commits
- Ensure tenant isolation

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Email: support@yourcompany.com
- Documentation: [docs.yourcompany.com](https://docs.yourcompany.com)

## 🗺️ Roadmap

### Upcoming Features
- [ ] Mobile API optimization
- [ ] Advanced reporting dashboard
- [ ] Third-party integrations (QuickBooks, etc.)
- [ ] Multi-currency support
- [ ] Advanced inventory management
- [ ] Customer mobile app API
- [ ] Webhook system
- [ ] Advanced analytics with ML insights

### Performance Improvements
- [ ] Query optimization
- [ ] Caching layer improvements
- [ ] Database connection optimization
- [ ] API response compression
- [ ] Background job processing

---

**Built with ❤️ for multi-tenant SaaS ecosystem**
# pos-backend-multitenant
