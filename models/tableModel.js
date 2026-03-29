const { DataTypes } = require('sequelize');

// Factory function to create Table model for given sequelize instance
module.exports = (sequelize) => {
    const Table = sequelize.define('Table', {
        id: {
            field: 'id',
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
            field: 'name',
            type: DataTypes.STRING,
            allowNull: false
        },
        tableNo: {
            field: 'table_no',
            type: DataTypes.STRING,
            allowNull: true
        },
        capacity: {
            field: 'capacity',
            type: DataTypes.INTEGER,
            defaultValue: 4
        },
        areaId: {
            field: 'area_id',
            type: DataTypes.UUID,
            allowNull: true
        },
        status: {
            field: 'status',
            type: DataTypes.STRING,
            defaultValue: 'Available'
        },
        currentOrderId: {
            field: 'current_order_id',
            type: DataTypes.UUID,
            allowNull: true
        },
        shape: {
            field: 'shape',
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: 'square'
        },
        currentOccupancy: {
            field: 'current_occupancy',
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0
        },
        qrCode: {
            field: 'qr_code',
            type: DataTypes.STRING,
            allowNull: true
        }
    }, {
        timestamps: true,
        underscored: true,
        freezeTableName: true,
        tableName: 'tables',
        indexes: [
            { fields: ['business_id'] },
            { fields: ['business_id', 'outlet_id'] },
            { fields: ['business_id', 'created_at'] },
            { fields: ['business_id', 'outlet_id', 'status'] },
            { fields: ['business_id', 'outlet_id', 'name'], unique: true }
            // { fields: ['business_id', 'outlet_id', 'table_no'], unique: true }  // TODO: Re-enable
        ]
    });

// Define associations
Table.associate = function(models) {
    Table.hasMany(models.Order, { foreignKey: 'tableId', as: 'orders' });
    Table.belongsTo(models.Area, { foreignKey: 'areaId', as: 'area' });
};

return Table;
};