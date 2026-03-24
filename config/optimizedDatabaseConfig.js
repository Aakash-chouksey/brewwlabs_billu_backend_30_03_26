/**
 * OPTIMIZED DATABASE CONFIGURATION
 * 
 * Configures shared connection pool for high scalability
 * Replaces per-tenant connections with efficient pooling
 */

module.exports = {
    // Shared connection pool configuration
    shared: {
        // Main database connection pool
        sequelize: {
            // Neon PostgreSQL - Connection URL required
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'neondb',
            username: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            dialect: 'postgres',
            
            // Optimized connection pooling
            pool: {
                max: 50,                    // Maximum connections in pool
                min: 5,                     // Minimum connections in pool
                acquire: 60000,             // Time to acquire connection (ms)
                idle: 10000,                // Idle time before connection removal (ms)
                evict: 1000,                // Check interval for idle connections (ms)
                handleDisconnects: true      // Handle disconnections gracefully
            },
            
            // Query optimization
            query: {
                raw: false,
                typeCast: true,
                nest: true,
                benchmark: process.env.NODE_ENV === 'development',
                logging: process.env.NODE_ENV === 'development'
            },
            
            // Performance optimizations
            dialectOptions: {
                ssl: process.env.DB_SSL === 'true' ? {
                    require: true,
                    rejectUnauthorized: false
                } : false,
                
                // PostgreSQL optimizations
                clientMinMessages: 'warning',
                application_name: 'pos_scalable',
                connectTimeout: 10000,
                statement_timeout: 30000
            },
            
            // Model configuration
            define: {
                underscored: true,
                freezeTableName: true,
                charset: 'utf8',
                collate: 'utf8_general_ci',
                timestamps: true,
                paranoid: false
            },
            
            // Sync and migration settings
            sync: {
                force: false,
                alter: false
            },
            
            // Retry configuration
            retry: {
                max: 3,
                timeout: 5000
            }
        }
    },
    
    // Control plane database (for tenant metadata)
    controlPlane: {
        host: process.env.CONTROL_PLANE_HOST,
        port: process.env.CONTROL_PLANE_PORT || 5432,
        database: process.env.CONTROL_PLANE_DATABASE || 'neondb',
        username: process.env.CONTROL_PLANE_USER,
        password: process.env.CONTROL_PLANE_PASSWORD,
        dialect: 'postgres',
        
        // Smaller pool for control plane
        pool: {
            max: 10,
            min: 2,
            acquire: 30000,
            idle: 10000,
            evict: 1000,
            handleDisconnects: true
        },
        
        dialectOptions: {
            ssl: process.env.CONTROL_PLANE_SSL === 'true' ? {
                require: true,
                rejectUnauthorized: false
            } : false,
            clientMinMessages: 'warning',
            application_name: 'pos_control_plane',
            connectTimeout: 10000,
            statement_timeout: 30000
        },
        
        define: {
            underscored: true,
            freezeTableName: true,
            charset: 'utf8',
            collate: 'utf8_general_ci',
            timestamps: true,
            paranoid: false
        },
        
        query: {
            raw: false,
            typeCast: true,
            nest: true,
            benchmark: process.env.NODE_ENV === 'development',
            logging: process.env.NODE_ENV === 'development'
        }
    },
    
    // Redis configuration for caching
    redis: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || '',
        db: process.env.REDIS_DB || 0,
        
        // Connection pooling for Redis
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        lazyConnect: true,
        keepAlive: 30000,
        connectTimeout: 10000,
        commandTimeout: 5000,
        
        // Clustering configuration (for production)
        cluster: process.env.REDIS_CLUSTER === 'true' ? {
            nodes: (process.env.REDIS_NODES || '').split(',').map(node => {
                const [host, port] = node.split(':');
                return { host, port: parseInt(port) || 6379 };
            }),
            options: {
                redisOptions: {
                    password: process.env.REDIS_PASSWORD,
                    maxRetriesPerRequest: 3,
                    retryDelayOnFailover: 100
                }
            }
        } : null
    },
    
    // PgBouncer configuration (external connection pooler)
    pgBouncer: {
        enabled: process.env.PGBOUNCER_ENABLED === 'true',
        host: process.env.PGBOUNCER_HOST,
        port: process.env.PGBOUNCER_PORT || 6432,
        database: process.env.PGBOUNCER_DATABASE || 'neondb',
        username: process.env.PGBOUNCER_USER,
        password: process.env.PGBOUNCER_PASSWORD || '',
        
        // PgBouncer pool modes
        poolMode: process.env.PGBOUNCER_POOL_MODE || 'transaction', // session, transaction, statement
        
        // Connection limits through PgBouncer
        maxConnections: process.env.PGBOUNCER_MAX_CONNECTIONS || 100,
        defaultPoolSize: process.env.PGBOUNCER_DEFAULT_POOL_SIZE || 20,
        minPoolSize: process.env.PGBOUNCER_MIN_POOL_SIZE || 5,
        
        // Timeout settings
        serverResetQuery: 'DISCARD ALL',
        serverLifetime: 3600, // 1 hour
        serverIdleTimeout: 600, // 10 minutes
        
        // Admin settings
        adminUsers: process.env.PGBOUNCER_ADMIN_USERS || 'postgres',
        statsUsers: process.env.PGBOUNCER_STATS_USERS || 'stats'
    },
    
    // Connection pool monitoring
    monitoring: {
        enabled: process.env.DB_MONITORING_ENABLED === 'true',
        interval: 30000, // 30 seconds
        alertThreshold: {
            maxConnections: 0.8, // Alert at 80% of max connections
            avgResponseTime: 1000, // Alert if avg response > 1s
            errorRate: 0.05 // Alert if error rate > 5%
        }
    },
    
    // Health check configuration
    healthCheck: {
        enabled: true,
        interval: 30000, // 30 seconds
        timeout: 5000, // 5 seconds
        retries: 3,
        
        // Health check queries
        queries: {
            shared: 'SELECT 1 as health_check',
            controlPlane: 'SELECT 1 as health_check'
        }
    }
};
