/**
 * ACCOUNTING CONTROLLER - Neon-Safe Transaction Pattern
 */

const createHttpError = require("http-errors");
const { Op } = require("sequelize");

/**
 * Create account
 */
exports.createAccount = async (req, res, next) => {
    try {
        const business_id = req.business_id || req.businessId;
        const outlet_id = req.outlet_id || req.outletId;
        const { name, type, openingBalance, accountNumber, bankName, description } = req.body;

        if (!name || !type) {
            throw createHttpError(400, "Account name and type are required");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Account } = models;
            
            return await Account.create({
                businessId: business_id,
                outletId: outlet_id, // Scoped to outlet for now
                name,
                type,
                openingBalance: Number(openingBalance) || 0,
                currentBalance: Number(openingBalance) || 0,
                accountNumber,
                bankName,
                description,
                isActive: true
            }, { transaction });
        });

        const responseData = result.data || result;
        res.status(201).json({ 
            success: true, 
            data: responseData, 
            message: "Account created successfully" 
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get all accounts
 */
exports.getAccounts = async (req, res, next) => {
    try {
        const business_id = req.business_id || req.businessId;
        const outlet_id = req.outlet_id || req.outletId;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { Account } = models;
            
            const whereClause = { businessId: business_id };
            if (outlet_id) whereClause.outletId = outlet_id;

            return await Account.findAll({
                where: whereClause,
                order: [['name', 'ASC']]
            });
        });

        const responseData = result.data || result || [];
        res.json({ 
            success: true, 
            data: responseData,
            message: "Accounts retrieved successfully"
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Add transaction
 */
exports.addTransaction = async (req, res, next) => {
    try {
        const business_id = req.business_id || req.businessId;
        const outlet_id = req.outlet_id || req.outletId;
        const { accountId, type, amount, description, category, referenceType, referenceId, date } = req.body;

        if (!accountId || !type || !amount) {
            throw createHttpError(400, "Account ID, type, and amount are required");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Account, AccountTransaction } = models;
            
            // Verify account exists
            const account = await Account.findOne({
                where: { id: accountId, businessId: business_id },
                transaction
            });
            if (!account) throw createHttpError(404, "Account not found");

            // Calculate new balance
            let currentBal = Number(account.currentBalance || 0);
            const txAmount = parseFloat(amount);

            let newBalance = currentBal;
            if (['CREDIT', 'INCOME', 'Revenue', 'CASH_IN'].includes(type)) {
                newBalance += txAmount;
            } else if (['DEBIT', 'EXPENSE', 'Expense', 'CASH_OUT'].includes(type)) {
                newBalance -= txAmount;
            } else {
                // Default fallback if type is ambiguous
                newBalance += txAmount;
            }

            // Create transaction
            const tx = await AccountTransaction.create({
                businessId: business_id,
                outletId: outlet_id,
                accountId,
                type,
                amount: txAmount,
                description,
                category,
                referenceType,
                referenceId,
                date: date || new Date(),
                balanceAfter: newBalance,
                createdBy: req.user?.id
            }, { transaction });

            // Update account balance
            await account.update({ currentBalance: newBalance }, { transaction });

            return { transaction: tx, account };
        });

        const responseData = result.data || result;
        res.status(201).json({ 
            success: true, 
            data: responseData, 
            message: "Transaction recorded successfully" 
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get transactions
 */
exports.getTransactions = async (req, res, next) => {
    try {
        const business_id = req.business_id || req.businessId;
        const outlet_id = req.outlet_id || req.outletId;
        const { accountId, type, startDate, endDate, category } = req.query;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { AccountTransaction, Account } = models;
            
            const whereClause = { businessId: business_id };
            if (outlet_id) whereClause.outletId = outlet_id;
            if (accountId) whereClause.accountId = accountId;
            if (type) whereClause.type = type;
            if (category) whereClause.category = category;
            if (startDate && endDate) {
                whereClause.date = { [Op.between]: [new Date(startDate), new Date(endDate)] };
            }

            return await AccountTransaction.findAll({
                where: whereClause,
                include: [{ model: Account, as: 'account', attributes: ['id', 'name', 'type'] }],
                order: [['date', 'DESC'], ['createdAt', 'DESC']]
            });
        });

        const responseData = result.data || result || [];
        res.json({ 
            success: true, 
            data: responseData,
            message: "Transactions retrieved successfully"
        });
    } catch (error) {
        next(error);
    }
};
