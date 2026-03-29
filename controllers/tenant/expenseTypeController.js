const createHttpError = require("http-errors");
const { enforceOutletScope, buildStrictWhereClause } = require("../../utils/outletGuard");

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

        const responseData = result.data || result || [];
        res.json({ 
            success: true, 
            data: responseData,
            message: "Expense types retrieved successfully"
        });
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
        const business_id = req.business_id || req.businessId;
        const outlet_id = req.outlet_id || req.outletId;
        const { name, description, color, isActive } = req.body;

        if (!name) {
            throw createHttpError(400, "Expense type name is required");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { ExpenseType } = models;
            
            return await ExpenseType.create({
                businessId: business_id,
                outletId: outlet_id,
                name,
                description,
                color: color || '#000000',
                isActive: isActive !== undefined ? isActive : true
            }, { transaction });
        });

        const responseData = result.data || result;
        res.status(201).json({ 
            success: true, 
            data: responseData, 
            message: "Expense type created successfully" 
        });
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
        const business_id = req.business_id || req.businessId;
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

        const responseData = result.data || result;
        res.json({ 
            success: true, 
            data: responseData, 
            message: "Expense type updated successfully" 
        });
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
        const business_id = req.business_id || req.businessId;

        await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { ExpenseType, Expense } = models;
            
            const { whereClause } = buildStrictWhereClause(req, { id });

            const expenseType = await ExpenseType.findOne({ where: whereClause, transaction });
            if (!expenseType) throw createHttpError(404, "Expense type not found");

            // Check if type has expenses
            const expenses = await Expense.count({
                where: { expenseTypeId: id },
                transaction
            });
            if (expenses > 0) {
                throw createHttpError(400, `Cannot delete expense type with ${expenses} expenses assigned`);
            }

            await expenseType.destroy({ transaction });
        });

        res.json({ 
            success: true, 
            message: "Expense type deleted successfully" 
        });
    } catch (error) {
        next(error);
    }
};
