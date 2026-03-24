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
            type: DataTypes.UUID, 
            allowNull: false,
            field: 'business_id'
        },
        outletId: { 
            type: DataTypes.UUID, 
            allowNull: false,
            field: 'outlet_id'
        },
        status: { 
            type: DataTypes.STRING, 
            defaultValue: 'active' 
        }
    }, {
        tableName: 'accounts',
        timestamps: true,
        underscored: true
    });

    return Account;
};
