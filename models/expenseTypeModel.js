const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const ExpenseType = sequelize.define('ExpenseType', {
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
        description: {
            type: DataTypes.STRING
        },
        isEnabled: {
            field: 'is_enabled',
            type: DataTypes.BOOLEAN,
            defaultValue: true
        }
    }, {
        tableName: 'expense_types',
        timestamps: true,
        underscored: true,
        freezeTableName: true,
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
