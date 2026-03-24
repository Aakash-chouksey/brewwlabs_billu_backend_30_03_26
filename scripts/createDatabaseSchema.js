const { sequelize } = require('../config/database_postgres');
const { controlPlaneSequelize } = require('../config/control_plane_db');

async function createDatabaseSchema() {
    try {
        console.log('🔧 Creating database schema...');
        
        // Create shared database tables
        console.log('📊 Creating shared database tables...');
        
        await sequelize.getQueryInterface().createTable('businesses', {
            id: {
                type: require('sequelize').DataTypes.UUID,
                defaultValue: require('sequelize').DataTypes.UUIDV4,
                primaryKey: true
            },
            name: {
                type: require('sequelize').DataTypes.STRING,
                allowNull: false
            },
            email: {
                type: require('sequelize').DataTypes.STRING,
                allowNull: false,
                unique: true
            },
            phone: {
                type: require('sequelize').DataTypes.STRING
            },
            address: {
                type: require('sequelize').DataTypes.STRING
            },
            status: {
                type: require('sequelize').DataTypes.ENUM('active', 'inactive', 'suspended', 'trial', 'pending', 'rejected'),
                defaultValue: 'pending'
            },
            subscription_plan: {
                type: require('sequelize').DataTypes.STRING,
                defaultValue: 'free'
            },
            owner_id: {
                type: require('sequelize').DataTypes.UUID,
                allowNull: true
            },
            created_at: {
                type: require('sequelize').DataTypes.DATE,
                allowNull: false,
                defaultValue: require('sequelize').DataTypes.NOW
            },
            updated_at: {
                type: require('sequelize').DataTypes.DATE,
                allowNull: false,
                defaultValue: require('sequelize').DataTypes.NOW
            }
        });

        await sequelize.getQueryInterface().createTable('users', {
            id: {
                type: require('sequelize').DataTypes.UUID,
                defaultValue: require('sequelize').DataTypes.UUIDV4,
                primaryKey: true
            },
            name: {
                type: require('sequelize').DataTypes.STRING,
                allowNull: false
            },
            email: {
                type: require('sequelize').DataTypes.STRING,
                allowNull: true
            },
            phone: {
                type: require('sequelize').DataTypes.STRING,
                allowNull: true
            },
            password_hash: {
                type: require('sequelize').DataTypes.STRING,
                allowNull: true
            },
            role: {
                type: require('sequelize').DataTypes.ENUM('SuperAdmin', 'BusinessAdmin', 'SubAdmin', 'Manager', 'Cashier', 'Waiter'),
                allowNull: false,
                defaultValue: 'Cashier'
            },
            brand_id: {
                type: require('sequelize').DataTypes.UUID,
                allowNull: false
            },
            business_id: {
                type: require('sequelize').DataTypes.UUID,
                allowNull: true
            },
            outlet_id: {
                type: require('sequelize').DataTypes.UUID,
                allowNull: true
            },
            is_verified: {
                type: require('sequelize').DataTypes.BOOLEAN,
                defaultValue: false
            },
            is_active: {
                type: require('sequelize').DataTypes.BOOLEAN,
                defaultValue: true
            },
            last_login: {
                type: require('sequelize').DataTypes.DATE,
                allowNull: true
            },
            panel_type: {
                type: require('sequelize').DataTypes.ENUM('ADMIN', 'TENANT'),
                allowNull: false,
                defaultValue: 'TENANT'
            },
            last_latitude: {
                type: require('sequelize').DataTypes.DECIMAL(10, 8),
                allowNull: true
            },
            last_longitude: {
                type: require('sequelize').DataTypes.DECIMAL(11, 8),
                allowNull: true
            },
            last_location_at: {
                type: require('sequelize').DataTypes.DATE,
                allowNull: true
            },
            token_version: {
                type: require('sequelize').DataTypes.INTEGER,
                defaultValue: 0
            },
            created_at: {
                type: require('sequelize').DataTypes.DATE,
                allowNull: false,
                defaultValue: require('sequelize').DataTypes.NOW
            },
            updated_at: {
                type: require('sequelize').DataTypes.DATE,
                allowNull: false,
                defaultValue: require('sequelize').DataTypes.NOW
            }
        });

        // Add indexes
        await sequelize.getQueryInterface().addIndex('users', ['brand_id']);
        await sequelize.getQueryInterface().addIndex('users', ['brand_id', 'outlet_id']);
        await sequelize.getQueryInterface().addIndex('users', ['brand_id', 'role']);
        await sequelize.getQueryInterface().addIndex('users', ['brand_id', 'is_active']);
        await sequelize.getQueryInterface().addIndex('users', {
            fields: ['brand_id', 'email'],
            unique: true,
            name: 'users_brand_email_unique'
        });

        await sequelize.getQueryInterface().createTable('outlets', {
            id: {
                type: require('sequelize').DataTypes.UUID,
                defaultValue: require('sequelize').DataTypes.UUIDV4,
                primaryKey: true
            },
            name: {
                type: require('sequelize').DataTypes.STRING,
                allowNull: false
            },
            brand_id: {
                type: require('sequelize').DataTypes.UUID,
                allowNull: false
            },
            business_name: {
                type: require('sequelize').DataTypes.STRING,
                allowNull: false
            },
            address: {
                type: require('sequelize').DataTypes.STRING,
                allowNull: true
            },
            contact_number: {
                type: require('sequelize').DataTypes.STRING,
                allowNull: true
            },
            is_active: {
                type: require('sequelize').DataTypes.BOOLEAN,
                defaultValue: true
            },
            created_at: {
                type: require('sequelize').DataTypes.DATE,
                allowNull: false,
                defaultValue: require('sequelize').DataTypes.NOW
            },
            updated_at: {
                type: require('sequelize').DataTypes.DATE,
                allowNull: false,
                defaultValue: require('sequelize').DataTypes.NOW
            }
        });

        await sequelize.getQueryInterface().createTable('product_types', {
            id: {
                type: require('sequelize').DataTypes.UUID,
                defaultValue: require('sequelize').DataTypes.UUIDV4,
                primaryKey: true
            },
            name: {
                type: require('sequelize').DataTypes.STRING,
                allowNull: false
            },
            brand_id: {
                type: require('sequelize').DataTypes.UUID,
                allowNull: false
            },
            outlet_id: {
                type: require('sequelize').DataTypes.UUID,
                allowNull: false
            },
            created_at: {
                type: require('sequelize').DataTypes.DATE,
                allowNull: false,
                defaultValue: require('sequelize').DataTypes.NOW
            },
            updated_at: {
                type: require('sequelize').DataTypes.DATE,
                allowNull: false,
                defaultValue: require('sequelize').DataTypes.NOW
            }
        });

        await sequelize.getQueryInterface().createTable('inventory_categories', {
            id: {
                type: require('sequelize').DataTypes.UUID,
                defaultValue: require('sequelize').DataTypes.UUIDV4,
                primaryKey: true
            },
            name: {
                type: require('sequelize').DataTypes.STRING,
                allowNull: false
            },
            brand_id: {
                type: require('sequelize').DataTypes.UUID,
                allowNull: false
            },
            outlet_id: {
                type: require('sequelize').DataTypes.UUID,
                allowNull: false
            },
            created_at: {
                type: require('sequelize').DataTypes.DATE,
                allowNull: false,
                defaultValue: require('sequelize').DataTypes.NOW
            },
            updated_at: {
                type: require('sequelize').DataTypes.DATE,
                allowNull: false,
                defaultValue: require('sequelize').DataTypes.NOW
            }
        });

        // Create control plane tables
        console.log('🏢 Creating control plane tables...');
        
        await controlPlaneSequelize.getQueryInterface().createTable('brands', {
            id: {
                type: require('sequelize').DataTypes.UUID,
                defaultValue: require('sequelize').DataTypes.UUIDV4,
                primaryKey: true
            },
            name: {
                type: require('sequelize').DataTypes.STRING,
                allowNull: false
            },
            email: {
                type: require('sequelize').DataTypes.STRING,
                allowNull: false
            },
            phone: {
                type: require('sequelize').DataTypes.STRING,
                allowNull: true
            },
            address: {
                type: require('sequelize').DataTypes.STRING,
                allowNull: true
            },
            status: {
                type: require('sequelize').DataTypes.ENUM('active', 'inactive', 'suspended'),
                defaultValue: 'active'
            },
            type: {
                type: require('sequelize').DataTypes.ENUM('SOLO', 'FRANCHISE'),
                defaultValue: 'SOLO'
            },
            business_id: {
                type: require('sequelize').DataTypes.UUID,
                allowNull: true
            },
            created_at: {
                type: require('sequelize').DataTypes.DATE,
                allowNull: false,
                defaultValue: require('sequelize').DataTypes.NOW
            },
            updated_at: {
                type: require('sequelize').DataTypes.DATE,
                allowNull: false,
                defaultValue: require('sequelize').DataTypes.NOW
            }
        });

        await controlPlaneSequelize.getQueryInterface().createTable('super_admin_users', {
            id: {
                type: require('sequelize').DataTypes.UUID,
                defaultValue: require('sequelize').DataTypes.UUIDV4,
                primaryKey: true
            },
            email: {
                type: require('sequelize').DataTypes.STRING,
                allowNull: false,
                unique: true
            },
            password_hash: {
                type: require('sequelize').DataTypes.STRING,
                allowNull: false
            },
            role: {
                type: require('sequelize').DataTypes.ENUM('SUPER_ADMIN'),
                allowNull: false,
                defaultValue: 'SUPER_ADMIN'
            },
            token_version: {
                type: require('sequelize').DataTypes.INTEGER,
                defaultValue: 0
            },
            created_at: {
                type: require('sequelize').DataTypes.DATE,
                allowNull: false,
                defaultValue: require('sequelize').DataTypes.NOW
            },
            updated_at: {
                type: require('sequelize').DataTypes.DATE,
                allowNull: false,
                defaultValue: require('sequelize').DataTypes.NOW
            }
        });

        console.log('✅ Database schema created successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating schema:', error.message);
        process.exit(1);
    }
}

createDatabaseSchema();
