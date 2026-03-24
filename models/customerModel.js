const { DataTypes } = require('sequelize');

// Factory function to create Customer model for given sequelize instance
module.exports = (sequelize) => {
    const Customer = sequelize.define('Customer', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        businessId: {
            type: DataTypes.UUID,
            allowNull: false,
            field: 'business_id'
        },
        outletId: {
            type: DataTypes.UUID,
            allowNull: false,
            field: 'outlet_id'
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        phone: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                is: /^[0-9]{10,15}$/
            }
        },
        email: {
            type: DataTypes.STRING,
            validate: {
                isEmail: true
            }
        },
        address: {
            type: DataTypes.TEXT
        },
        totalDue: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0.00,
            field: 'total_due'
        },
        totalPaid: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0.00,
            field: 'total_paid'
        },
        lastVisitAt: {
            type: DataTypes.DATE,
            field: 'last_visit_at'
        },
        visitCount: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            field: 'visit_count'
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            field: 'is_active'
        }
    }, {
        tableName: 'customers',
        timestamps: true,
        underscored: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                fields: ['business_id']
            },
            {
                fields: ['business_id', 'outlet_id']
            },
            {
                fields: ['business_id', 'outlet_id', 'phone'],
                unique: true
            },
            {
                fields: ['business_id', 'outlet_id', 'name']
            }
        ]
    });

    // Define associations
    Customer.associate = function(models) {
        Customer.hasMany(models.Order, { foreignKey: 'customerId', as: 'orders' });
        Customer.hasMany(models.CustomerTransaction, { foreignKey: 'customerId', as: 'transactions' });
        Customer.hasMany(models.CustomerLedger, { foreignKey: 'customerId', as: 'ledgerEntries' });
    };

    return Customer;
};
