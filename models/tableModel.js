const { DataTypes } = require('sequelize');

// Factory function to create Table model for given sequelize instance
module.exports = (sequelize) => {
    const Table = sequelize.define('Table', {
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
    tableNo: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'table_no'
    },
    capacity: {
        type: DataTypes.INTEGER,
        defaultValue: 4
    },
    areaId: {
        type: DataTypes.UUID, // FK to Area (optional for now)
        allowNull: true,
        field: 'area_id'
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: 'Available'
    },
    currentOrderId: {
        type: DataTypes.UUID, // FK to Order
        allowNull: true,
        field: 'current_order_id'
    },
    shape: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: 'square'
    },
    currentOccupancy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
        field: 'current_occupancy'
    },
    qrCode: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'qr_code'
    }
}, {
    timestamps: true,
    underscored: true,
    tableName: 'tables',
    indexes: [
        { fields: ['business_id'] },
        { fields: ['business_id', 'outlet_id'] },
        { fields: ['business_id', 'created_at'] },
        { fields: ['business_id', 'outlet_id', 'status'] },
        { fields: ['business_id', 'outlet_id', 'name'], unique: true },
        { fields: ['business_id', 'outlet_id', 'table_no'], unique: true }
    ]
});

// Define associations
Table.associate = function(models) {
    Table.hasMany(models.Order, { foreignKey: 'tableId', as: 'orders' });
    Table.belongsTo(models.Area, { foreignKey: 'areaId', as: 'area' });
};

return Table;
};