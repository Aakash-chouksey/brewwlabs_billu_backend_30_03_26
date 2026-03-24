const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Expense = sequelize.define('Expense', {
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
        expenseTypeId: {
            type: DataTypes.UUID,
            allowNull: false,
            field: 'expense_type_id'
        },
        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        description: {
            type: DataTypes.STRING
        },
        date: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        paymentMethod: {
            type: DataTypes.STRING,
            defaultValue: "Cash"
        }
    }, {
        tableName: 'expenses',
        timestamps: true,
        underscored: true,
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
        Expense.belongsTo(models.Business, { foreignKey: 'business_id', as: 'business' });
        Expense.belongsTo(models.Outlet, { foreignKey: 'outlet_id', as: 'outlet' });
        Expense.belongsTo(models.ExpenseType, { foreignKey: 'expense_type_id', as: 'expenseType' });
    };

    return Expense;
};
