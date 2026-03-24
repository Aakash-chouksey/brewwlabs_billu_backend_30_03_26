const { Sequelize } = require('sequelize');
require('dotenv').config();

// Database connection
const sequelize = new Sequelize(process.env.DATABASE_URL, {
    logging: console.log,
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false
        }
    }
});

async function initializeDatabase() {
    console.log('🔄 Initializing database...');
    
    try {
        // Test connection
        await sequelize.authenticate();
        console.log('✅ Database connection established');
        
        // Create control plane tables first
        console.log('📋 Creating control plane tables...');
        
        // SuperAdmin Users table
        await sequelize.getQueryInterface().createTable('super_admin_users', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true
            },
            email: {
                type: Sequelize.STRING,
                allowNull: false,
                unique: true
            },
            password_hash: {
                type: Sequelize.STRING,
                allowNull: false
            },
            role: {
                type: Sequelize.ENUM('SUPER_ADMIN'),
                defaultValue: 'SUPER_ADMIN'
            },
            createdAt: {
                type: Sequelize.DATE,
                allowNull: false
            },
            updatedAt: {
                type: Sequelize.DATE,
                allowNull: false
            }
        });
        
        // Businesses table
        await sequelize.getQueryInterface().createTable('businesses', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true
            },
            name: {
                type: Sequelize.STRING,
                allowNull: false
            },
            email: {
                type: Sequelize.STRING,
                allowNull: false
            },
            phone: {
                type: Sequelize.STRING
            },
            status: {
                type: Sequelize.ENUM('active', 'pending', 'suspended', 'trial'),
                defaultValue: 'pending'
            },
            subscription_plan: {
                type: Sequelize.STRING
            },
            subscription_expires_at: {
                type: Sequelize.DATE
            },
            approved_by: {
                type: Sequelize.UUID
            },
            approved_at: {
                type: Sequelize.DATE
            },
            rejection_reason: {
                type: Sequelize.TEXT
            },
            assigned_categories: {
                type: Sequelize.JSON
            },
            api_usage: {
                type: Sequelize.INTEGER,
                defaultValue: 0
            },
            createdAt: {
                type: Sequelize.DATE,
                allowNull: false
            },
            updatedAt: {
                type: Sequelize.DATE,
                allowNull: false
            }
        });
        
        // Subscriptions table
        await sequelize.getQueryInterface().createTable('subscriptions', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true
            },
            name: {
                type: Sequelize.STRING,
                allowNull: false
            },
            price: {
                type: Sequelize.DECIMAL(10, 2),
                allowNull: false
            },
            features: {
                type: Sequelize.JSON
            },
            max_outlets: {
                type: Sequelize.INTEGER,
                defaultValue: 1
            },
            max_users: {
                type: Sequelize.INTEGER,
                defaultValue: 5
            },
            is_active: {
                type: Sequelize.BOOLEAN,
                defaultValue: true
            },
            createdAt: {
                type: Sequelize.DATE,
                allowNull: false
            },
            updatedAt: {
                type: Sequelize.DATE,
                allowNull: false
            }
        });
        
        // Tenant Connections table
        await sequelize.getQueryInterface().createTable('tenant_connections', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true
            },
            business_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'businesses',
                    key: 'id'
                }
            },
            database_name: {
                type: Sequelize.STRING,
                allowNull: false
            },
            connection_string: {
                type: Sequelize.STRING,
                allowNull: false
            },
            status: {
                type: Sequelize.ENUM('active', 'inactive', 'suspended'),
                defaultValue: 'active'
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false
            }
        });
        
        // Audit Logs table
        await sequelize.getQueryInterface().createTable('audit_logs', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true
            },
            admin_id: {
                type: Sequelize.UUID
            },
            tenant_id: {
                type: Sequelize.UUID
            },
            action: {
                type: Sequelize.STRING,
                allowNull: false
            },
            entity_type: {
                type: Sequelize.STRING
            },
            entity_id: {
                type: Sequelize.UUID
            },
            details: {
                type: Sequelize.JSON
            },
            ip_address: {
                type: Sequelize.STRING
            },
            user_agent: {
                type: Sequelize.STRING
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false
            }
        });
        
        console.log('✅ Control plane tables created');
        
        // Create basic tenant tables
        console.log('📋 Creating basic tenant tables...');
        
        // Users table
        await sequelize.getQueryInterface().createTable('users', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true
            },
            name: {
                type: Sequelize.STRING,
                allowNull: false
            },
            email: {
                type: Sequelize.STRING,
                allowNull: false
            },
            phone: {
                type: Sequelize.STRING
            },
            role: {
                type: Sequelize.ENUM('SuperAdmin', 'BusinessAdmin', 'SubAdmin', 'Manager', 'Cashier', 'Waiter'),
                defaultValue: 'Waiter'
            },
            business_id: {
                type: Sequelize.UUID
            },
            outlet_id: {
                type: Sequelize.UUID
            },
            password_hash: {
                type: Sequelize.STRING
            },
            otp: {
                type: Sequelize.JSON
            },
            assigned_categories: {
                type: Sequelize.JSON
            },
            permissions: {
                type: Sequelize.JSON
            },
            is_verified: {
                type: Sequelize.BOOLEAN,
                defaultValue: false
            },
            status: {
                type: Sequelize.ENUM('active', 'blocked'),
                defaultValue: 'active'
            },
            token_version: {
                type: Sequelize.INTEGER,
                defaultValue: 0
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false
            }
        });
        
        // Categories table
        await sequelize.getQueryInterface().createTable('categories', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true
            },
            name: {
                type: Sequelize.STRING,
                allowNull: false
            },
            description: {
                type: Sequelize.TEXT
            },
            color: {
                type: Sequelize.STRING
            },
            image: {
                type: Sequelize.STRING
            },
            business_id: {
                type: Sequelize.UUID,
                allowNull: false
            },
            is_enabled: {
                type: Sequelize.BOOLEAN,
                defaultValue: true
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false
            }
        });
        
        // Products table
        await sequelize.getQueryInterface().createTable('products', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true
            },
            name: {
                type: Sequelize.STRING,
                allowNull: false
            },
            description: {
                type: Sequelize.TEXT
            },
            price: {
                type: Sequelize.DECIMAL(10, 2),
                allowNull: false
            },
            category_id: {
                type: Sequelize.UUID
            },
            business_id: {
                type: Sequelize.UUID,
                allowNull: false
            },
            outlet_id: {
                type: Sequelize.UUID
            },
            image: {
                type: Sequelize.STRING
            },
            product_type: {
                type: Sequelize.ENUM('veg', 'non-veg', 'vegan'),
                defaultValue: 'veg'
            },
            is_available: {
                type: Sequelize.BOOLEAN,
                defaultValue: true
            },
            stock: {
                type: Sequelize.INTEGER,
                defaultValue: 0
            },
            track_stock: {
                type: Sequelize.BOOLEAN,
                defaultValue: false
            },
            recipe: {
                type: Sequelize.JSON
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false
            }
        });
        
        // Outlets table
        await sequelize.getQueryInterface().createTable('outlets', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true
            },
            name: {
                type: Sequelize.STRING,
                allowNull: false
            },
            business_id: {
                type: Sequelize.UUID,
                allowNull: false
            },
            address: {
                type: Sequelize.TEXT
            },
            phone: {
                type: Sequelize.STRING
            },
            email: {
                type: Sequelize.STRING
            },
            is_active: {
                type: Sequelize.BOOLEAN,
                defaultValue: true
            },
            opening_time: {
                type: Sequelize.TIME
            },
            closing_time: {
                type: Sequelize.TIME
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false
            }
        });
        
        console.log('✅ Basic tenant tables created');
        
        // Insert initial data
        await insertInitialData();
        
        console.log('🎉 Database initialization completed successfully!');
        
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        throw error;
    } finally {
        await sequelize.close();
    }
}

async function insertInitialData() {
    console.log('📝 Inserting initial data...');
    
    const bcrypt = require('bcrypt');
    
    try {
        // Create SuperAdmin user
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await sequelize.query(`
            INSERT INTO super_admin_users (id, email, password_hash, role, created_at, updated_at)
            VALUES (gen_random_uuid(), 'admin@brewwlabs.com', :passwordHash, 'SUPER_ADMIN', NOW(), NOW())
        `, {
            replacements: { passwordHash: hashedPassword }
        });
        console.log('✅ SuperAdmin user created (email: admin@brewwlabs.com, password: [REDACTED])');
        
        // Create sample subscription plans
        await sequelize.query(`
            INSERT INTO subscriptions (id, name, price, features, max_outlets, max_users, is_active, created_at, updated_at)
            VALUES 
                (gen_random_uuid(), 'Basic', 29.99, '{"pos": true, "inventory": true, "reports": true}', 1, 5, true, NOW(), NOW()),
                (gen_random_uuid(), 'Pro', 99.99, '{"pos": true, "inventory": true, "reports": true, "analytics": true, "multi_outlet": true}', 5, 20, true, NOW(), NOW()),
                (gen_random_uuid(), 'Enterprise', 299.99, '{"pos": true, "inventory": true, "reports": true, "analytics": true, "multi_outlet": true, "api_access": true, "custom_integrations": true}', -1, -1, true, NOW(), NOW())
        `);
        console.log('✅ Subscription plans created');
        
    } catch (error) {
        console.error('❌ Failed to insert initial data:', error);
        throw error;
    }
}

// Run the initialization
if (require.main === module) {
    initializeDatabase().catch(console.error);
}

module.exports = { initializeDatabase, insertInitialData };
