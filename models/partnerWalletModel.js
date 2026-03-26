const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const PartnerWallet = sequelize.define('PartnerWallet', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        businessId: {
            field: 'business_id',
            type: DataTypes.UUID, allowNull: false, unique: true }, // One wallet per partner business
        balance: { 
            type: DataTypes.DECIMAL(10, 2), 
            defaultValue: 0,
            get() { return parseFloat(this.getDataValue('balance')); }
        },
        transactions: { type: DataTypes.JSONB, defaultValue: [] } // Array of { type, amount, date, description }
    }, {
        tableName: 'partner_wallets',
        underscored: true,
        freezeTableName: true,
        timestamps: true
    });

    return PartnerWallet;
};
