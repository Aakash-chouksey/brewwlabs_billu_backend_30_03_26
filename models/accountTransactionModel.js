const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const AccountTransaction = sequelize.define('AccountTransaction', {
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
            field: 'account_id',
            type: DataTypes.UUID, 
            allowNull: false
        },
        date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
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
        performedBy: {
            field: 'performed_by',
            type: DataTypes.UUID,
            allowNull: true
        }
    }, {
        tableName: 'account_transactions',
        timestamps: true,
        underscored: true,
        freezeTableName: true
    });

    AccountTransaction.associate = (models) => {
        AccountTransaction.belongsTo(models.Account, { foreignKey: 'account_id', as: 'account' });
    };

    return AccountTransaction;
};
