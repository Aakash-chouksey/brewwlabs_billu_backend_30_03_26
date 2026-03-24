const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Transaction = sequelize.define('Transaction', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        type: { 
            type: DataTypes.STRING, 
            allowNull: false 
        },
        category: { type: DataTypes.STRING, allowNull: false },
        amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
        description: { type: DataTypes.STRING },
        accountId: { 
            type: DataTypes.UUID, 
            allowNull: false,
            field: 'account_id'
        },
        date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
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
        performedBy: { 
            type: DataTypes.UUID,
            allowNull: true,
            field: 'performed_by'
        }
    }, {
        tableName: 'transactions',
        timestamps: true,
        underscored: true
    });

    return Transaction;
};
