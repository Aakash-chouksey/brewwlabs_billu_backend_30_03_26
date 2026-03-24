const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const ExpenseType = sequelize.define('ExpenseType', {
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
        description: {
            type: DataTypes.STRING
        },
        isEnabled: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            field: 'is_enabled'
        }
    }, {
        tableName: 'expense_types',
        timestamps: true,
        underscored: true,
        indexes: [
            { fields: ['business_id'] },
            { fields: ['business_id', 'outlet_id'] },
            { fields: ['business_id', 'outlet_id', 'name'], unique: true }
        ]
    });

    ExpenseType.associate = function(models) {
        ExpenseType.hasMany(models.Expense, { foreignKey: 'expenseTypeId', as: 'expenses' });
    };

    return ExpenseType;
};
