# 🚀 Production Scaling & Performance Guide

## 📊 Current System Capabilities

### **Supported Load:**
- **Tenants**: 100+ (with current LRU cache)
- **Concurrent Users**: 1,000+ (per instance)
- **Database Connections**: 5 per tenant (conservative)
- **Request Rate**: ~500 RPM (rate limited)

---

## 🎯 Scaling Targets

### **Phase 1: 10K Concurrent Users**
- **Instances**: 3-5 Node.js containers
- **Database**: Connection pooling optimization
- **Redis**: Cluster mode
- **Load Balancer**: AWS ALB with health checks

### **Phase 2: 50K Concurrent Users**
- **Instances**: 5-10 Node.js containers
- **Database**: Read replicas for tenant DBs
- **Redis**: Enterprise cluster
- **CDN**: Cloudflare for static assets

### **Phase 3: 100K+ Concurrent Users**
- **Instances**: 10+ Node.js containers
- **Database**: Sharding strategy
- **Microservices**: Split by domain
- **Event Streaming**: Kafka/RabbitMQ

---

## 🔧 Performance Optimizations

### **1. Database Scaling**

#### **Connection Pooling (Immediate)**
```javascript
// Update tenantConnectionFactory.js
this.defaultPoolConfig = {
    max: 10, // Increase from 5
    min: 2,  // Increase from 1
    acquire: 30000,
    idle: 10000,
    evict: 10000
};
```

#### **PgBouncer Setup (Recommended)**
```bash
# Install PgBouncer
apt-get install pgbouncer

# Configuration for pgbouncer.ini
[databases]
* = host=neon-db port=5432

[pgbouncer]
listen_port = 6432
listen_addr = 127.0.0.1
auth_type = scram-sha-256
max_client_conn = 1000
default_pool_size = 20
min_pool_size = 5
reserve_pool_size = 5
reserve_pool_timeout = 5
max_db_connections = 50
max_user_connections = 50
server_reset_query = DISCARD ALL
ignore_startup_parameters = extra_float_digits
```

#### **Read Replicas (Phase 2)**
```javascript
// Enhanced tenant connection factory
async getConnection(brandId, options = {}) {
    const { readReplica = false } = options;
    
    if (readReplica && this.readReplicaCache.has(brandId)) {
        return this.readReplicaCache.get(brandId);
    }
    
    // Create read replica connection
    const replicaSequelize = new Sequelize(readReplicaUrl, {
        dialect: 'postgres',
        pool: { max: 15, min: 2 },
        // ... other config
    });
    
    this.readReplicaCache.set(brandId, replicaSequelize);
    return replicaSequelize;
}
```

### **2. Caching Strategy**

#### **Multi-Level Caching**
```javascript
// Enhanced caching strategy
class MultiLevelCache {
    constructor() {
        this.l1Cache = new Map(); // Memory cache
        this.l2Cache = redis;    // Redis cache
        this.l3Cache = null;      // Database
    }
    
    async get(key) {
        // L1: Memory cache (fastest)
        if (this.l1Cache.has(key)) {
            return this.l1Cache.get(key);
        }
        
        // L2: Redis cache (fast)
        const redisData = await this.l2Cache.get(key);
        if (redisData) {
            this.l1Cache.set(key, JSON.parse(redisData));
            return JSON.parse(redisData);
        }
        
        // L3: Database (slow)
        const dbData = await this.fetchFromDB(key);
        await this.set(key, dbData);
        return dbData;
    }
    
    async set(key, value, ttl = 300) {
        this.l1Cache.set(key, value);
        await this.l2Cache.setex(key, ttl, JSON.stringify(value));
    }
}
```

#### **Redis Cluster Configuration**
```yaml
# docker-compose.yml redis cluster
redis-master:
  image: redis:7-alpine
  command: redis-server --cluster-enabled yes --cluster-config-file nodes.conf
  
redis-replica-1:
  image: redis:7-alpine
  command: redis-server --cluster-enabled yes --cluster-config-file nodes.conf --replicaof redis-master 6379
```

### **3. Application Scaling**

#### **Horizontal Scaling with Session Affinity**
```javascript
// Sticky sessions for Socket.IO
const io = new Server(server, {
    adapter: require('socket.io-redis-adapter')(redis.createClient(), redis.createClient()),
    cors: { origin: allowedOrigins }
});
```

#### **Worker Threads for CPU Intensive Tasks**
```javascript
// Use worker threads for heavy processing
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

if (isMainThread) {
    // Main thread
    const worker = new Worker(__filename, { workerData: heavyTaskData });
    worker.on('message', (result) => {
        console.log('Worker result:', result);
    });
} else {
    // Worker thread
    const result = performHeavyComputation(workerData);
    parentPort.postMessage(result);
}
```

### **4. Load Balancing**

#### **AWS Application Load Balancer**
```yaml
# Target Group Configuration
TargetGroupAttributes:
  - Key: deregistration_delay.timeout_seconds
    Value: '30'
  - Key: stickiness.enabled
    Value: 'true'
  - Key: stickiness.type
    Value: 'lb_cookie'
  - Key: stickiness.duration_seconds
    Value: '86400'
```

#### **Nginx Upstream Configuration**
```nginx
upstream backend {
    least_conn;
    server backend1:8000 max_fails=3 fail_timeout=30s;
    server backend2:8000 max_fails=3 fail_timeout=30s;
    server backend3:8000 max_fails=3 fail_timeout=30s;
    
    # Health check
    keepalive 32;
}

# Rate limiting per IP
limit_req_zone $binary_remote_addr zone=api:10m rate=100r/s;
limit_req_zone $binary_remote_addr zone=auth:10m rate=20r/s;
```

---

## 📈 Monitoring & Observability

### **1. Application Metrics**

#### **Prometheus + Grafana Setup**
```javascript
// metrics.js
const prometheus = require('prom-client');

// Create metrics
const httpRequestDuration = new prometheus.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code']
});

const activeConnections = new prometheus.Gauge({
    name: 'active_connections_total',
    help: 'Total number of active connections'
});

const tenantConnections = new prometheus.Gauge({
    name: 'tenant_connections_total',
    help: 'Number of tenant connections',
    labelNames: ['brand_id']
});

// Middleware to track metrics
app.use((req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        httpRequestDuration
            .labels(req.method, req.route?.path || req.path, res.statusCode)
            .observe(duration);
    });
    
    next();
});
```

#### **Health Check Enhancements**
```javascript
// Enhanced health check
app.get('/health/detailed', async (req, res) => {
    const health = {
        status: 'UP',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version,
        checks: {}
    };
    
    try {
        // Database health
        await sequelize.authenticate();
        health.checks.database = { status: 'UP' };
        
        // Redis health
        await redis.ping();
        health.checks.redis = { status: 'UP' };
        
        // Tenant connections health
        const tenantHealth = await tenantFactory.healthCheck();
        health.checks.tenantConnections = tenantHealth;
        
        // Memory usage
        health.memory = process.memoryUsage();
        
        // Connection pool stats
        health.connectionPools = {
            controlPlane: controlPlaneSequelize.connectionManager.pool,
            tenants: tenantFactory.getStats()
        };
        
    } catch (error) {
        health.status = 'DOWN';
        health.error = error.message;
        return res.status(503).json(health);
    }
    
    res.json(health);
});
```

### **2. Database Monitoring**

#### **Query Performance Tracking**
```javascript
// Track slow queries
sequelize.addHook('beforeQuery', (options) => {
    options.startTime = Date.now();
});

sequelize.addHook('afterQuery', (options) => {
    const duration = Date.now() - options.startTime;
    
    if (duration > 1000) { // Log slow queries (> 1s)
        console.warn(`Slow Query (${duration}ms):`, options.sql);
        
        // Send to monitoring system
        metrics.slowQueries.inc({
            query_type: options.type,
            duration_bucket: getDurationBucket(duration)
        });
    }
});
```

### **3. Alerting Setup**

#### **Prometheus Alert Rules**
```yaml
# alerts.yml
groups:
- name: brewwlabs-pos
  rules:
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "High error rate detected"
      
  - alert: HighResponseTime
    expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "95th percentile response time is high"
      
  - alert: DatabaseConnectionsHigh
    expr: active_connections_total > 80
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Database connections are high"
```

---

## 🛡️ Security Scaling

### **1. Rate Limiting Enhancement**

#### **Distributed Rate Limiting**
```javascript
// Enhanced rate limiting with Redis
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('./config/redis');

const createRateLimit = (windowMs, max, keyGenerator) => rateLimit({
    store: new RedisStore({
        client: redis,
        prefix: 'rl:',
        resetExpiryOnChange: true
    }),
    windowMs,
    max,
    keyGenerator,
    standardHeaders: true,
    legacyHeaders: false
});

// Different limits for different user types
const tenantRateLimit = createRateLimit(
    15 * 60 * 1000, // 15 minutes
    1000, // 1000 requests per window
    (req) => `tenant:${req.auth?.userId || req.ip}`
);

const authRateLimit = createRateLimit(
    15 * 60 * 1000, // 15 minutes
    100, // 100 requests per window
    (req) => `auth:${req.ip}`
);
```

### **2. DDoS Protection**

#### **Cloudflare Integration**
```javascript
// Cloudflare IP validation
app.use((req, res, next) => {
    const cfConnectingIp = req.headers['cf-connecting-ip'];
    const cfRay = req.headers['cf-ray'];
    
    if (cfRay) {
        req.ip = cfConnectingIp || req.ip;
        req.cloudflare = true;
    }
    
    next();
});
```

---

## 🚀 Scaling Roadmap

### **Month 1-2: Foundation**
- [ ] Implement PgBouncer
- [ ] Add Redis clustering
- [ ] Set up monitoring
- [ ] Optimize connection pools

### **Month 3-4: Growth**
- [ ] Add read replicas
- [ ] Implement multi-level caching
- [ ] Set up auto-scaling
- [ ] Add CDN

### **Month 5-6: Scale**
- [ ] Database sharding
- [ ] Microservices migration
- [ ] Event streaming
- [ ] Advanced monitoring

---

## 📊 Performance Benchmarks

### **Target Metrics:**
- **Response Time**: < 200ms (95th percentile)
- **Error Rate**: < 0.1%
- **Uptime**: > 99.9%
- **Database Connections**: < 80% utilization
- **Memory Usage**: < 70% per container

### **Load Testing:**
```bash
# Artillery load test
artillery run load-test.yml

# load-test.yml
config:
  target: 'http://localhost:8000'
  phases:
    - duration: 60
      arrivalRate: 10
    - duration: 120
      arrivalRate: 50
    - duration: 300
      arrivalRate: 100

scenarios:
  - name: "API Load Test"
    weight: 70
    flow:
      - get:
          url: "/api/tenant/products"
      - get:
          url: "/api/tenant/orders"
          
  - name: "Auth Load Test"
    weight: 30
    flow:
      - post:
          url: "/api/auth/login"
          json:
            email: "test@example.com"
            password: "password123"
```

This scaling guide provides a comprehensive roadmap for handling 10K+ concurrent users while maintaining system reliability and performance.
