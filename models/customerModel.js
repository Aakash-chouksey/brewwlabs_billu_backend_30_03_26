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
            field: 'business_id',
            type: DataTypes.UUID,
            allowNull: false
        },
        outletId: {
            field: 'outlet_id',
            type: DataTypes.UUID,
            allowNull: false
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
            field: 'total_due',
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0.00
        },
        totalPaid: {
            field: 'total_paid',
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0.00
        },
        lastVisitAt: {
            type: DataTypes.DATE,
            field: 'last_visit_at'
        },
        visitCount: {
            field: 'visit_count',
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        isActive: {
            field: 'is_active',
            type: DataTypes.BOOLEAN,
            defaultValue: true
        }
    }, {
        tableName: 'customers',
        timestamps: true,
        underscored: true,
        freezeTableName: true,
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
