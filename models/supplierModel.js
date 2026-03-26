const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Supplier = sequelize.define('Supplier', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            field: 'id'
        },
        businessId: {
            field: 'business_id',
            type: DataTypes.UUID,
            allowNull: false,
            field: 'business_id'
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            field: 'name'
        },
        contactPerson: {
            type: DataTypes.STRING,
            field: 'contact_person'
        },
        email: {
            type: DataTypes.STRING,
            field: 'email'
        },
        phone: {
            type: DataTypes.STRING,
            field: 'phone'
        },
        address: {
            type: DataTypes.TEXT,
            field: 'address'
        },
        gstNumber: {
            type: DataTypes.STRING,
            field: 'gst_number'
        },
        paymentTerms: {
            type: DataTypes.STRING,
            field: 'payment_terms'
        },
        notes: {
            type: DataTypes.TEXT,
            field: 'notes'
        },
        isActive: {
            field: 'is_active',
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            field: 'is_active'
        },
        createdAt: {
            type: DataTypes.DATE,
            field: 'created_at'
        },
        updatedAt: {
            type: DataTypes.DATE,
            field: 'updated_at'
        }
    }, {
        tableName: 'suppliers',
        timestamps: true,
        underscored: true,
        freezeTableName: true
    });

    Supplier.associate = (models) => {
        Supplier.hasMany(models.InventoryItem, { foreignKey: 'supplierId', as: 'inventoryItems' });
    };

    return Supplier;
};
