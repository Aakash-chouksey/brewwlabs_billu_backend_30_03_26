const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Account = sequelize.define('Account', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        name: { type: DataTypes.STRING, allowNull: false },
        type: { 
            type: DataTypes.STRING, 
            defaultValue: 'Cash' 
        },
        balance: { 
            type: DataTypes.DECIMAL(10, 2), 
            defaultValue: 0,
            get() { return parseFloat(this.getDataValue('balance')); }
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
        status: { 
            type: DataTypes.STRING, 
            defaultValue: 'active' 
        }
    }, {
        tableName: 'accounts',
        timestamps: true,
        underscored: true,
        freezeTableName: true
    });

    return Account;
};
