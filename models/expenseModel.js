const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Expense = sequelize.define('Expense', {
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
        expenseTypeId: {
            field: 'expense_type_id',
            type: DataTypes.UUID,
            allowNull: false
        },
        amount: {
            field: 'amount',
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        description: {
            field: 'description',
            type: DataTypes.STRING
        },
        date: {
            field: 'date',
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        paymentMethod: {
            field: 'payment_method',
            type: DataTypes.STRING,
            defaultValue: "Cash"
        }
    }, {
        tableName: 'expenses',
        timestamps: true,
        underscored: true,
        freezeTableName: true,
        indexes: [
            {
                fields: ['business_id']
            },
            {
                fields: ['business_id', 'outlet_id']
            },
            {
                fields: ['business_id', 'expense_type_id']
            },
            {
                fields: ['business_id', 'date']
            }
        ]
    });

    Expense.associate = function(models) {
        Expense.belongsTo(models.Outlet, { foreignKey: 'outlet_id', as: 'outlet' });
        Expense.belongsTo(models.ExpenseType, { foreignKey: 'expense_type_id', as: 'expenseType' });
    };

    return Expense;
};
