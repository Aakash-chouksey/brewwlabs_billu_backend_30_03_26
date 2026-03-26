const createHttpError = require("http-errors");
const { enforceOutletScope, buildStrictWhereClause } = require("../utils/outletGuard");

/**
 * Get all expense types
 */
exports.getExpenseTypes = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        
        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { ExpenseType } = models;
            
            const { whereClause } = buildStrictWhereClause(req);
            
            return await ExpenseType.findAll({
                where: whereClause,
                order: [['name', 'ASC']]
            });
        });

        console.log('[EXPENSE TYPE CONTROLLER] getExpenseTypes result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const responseData = result.data || result;
        res.json({ success: true, data: responseData || [] });
    } catch (error) {
        next(error);
    }
};

/**
 * Create expense type
 */
exports.createExpenseType = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const { businessId, outletId } = req;
        const { name, description, color, isActive } = req.body;

        if (!name) {
            throw createHttpError(400, "Expense type name is required");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { ExpenseType } = models;
            
            return await ExpenseType.create({
                businessId,
                outletId,
                name,
                description,
                color: color || '#000000',
                isActive: isActive !== undefined ? isActive : true
            }, { transaction });
        });

        console.log('[EXPENSE TYPE CONTROLLER] createExpenseType result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const responseData = result.data || result;
        res.status(201).json({ success: true, data: responseData, message: "Expense type created" });
    } catch (error) {
        next(error);
    }
};

/**
 * Update expense type
 */
exports.updateExpenseType = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const { id } = req.params;
        const { businessId } = req;
        const updateData = req.body;

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { ExpenseType } = models;
            
            const { whereClause } = buildStrictWhereClause(req, { id });

            const expenseType = await ExpenseType.findOne({ where: whereClause, transaction });
            if (!expenseType) throw createHttpError(404, "Expense type not found");

            await expenseType.update(updateData, { transaction });
            return expenseType;
        });

        console.log('[EXPENSE TYPE CONTROLLER] updateExpenseType result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const responseData = result.data || result;
        res.json({ success: true, data: responseData, message: "Expense type updated" });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete expense type
 */
exports.deleteExpenseType = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const { id } = req.params;
        const { businessId } = req;

        await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { ExpenseType, Expense } = models;
            
            const { whereClause } = buildStrictWhereClause(req, { id });

            // Check if type has expenses
            const expenses = await Expense.count({
                where: { expenseTypeId: id },
                transaction
            });
            if (expenses > 0) {
                throw createHttpError(400, `Cannot delete expense type with ${expenses} expenses`);
            }

            const expenseType = await ExpenseType.findOne({ where: whereClause, transaction });
            if (!expenseType) throw createHttpError(404, "Expense type not found");

            await expenseType.destroy({ transaction });
        });

        res.json({ success: true, message: "Expense type deleted" });
    } catch (error) {
        next(error);
    }
};
