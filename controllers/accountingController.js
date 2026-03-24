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
        const { businessId } = req;
        const { name, type, openingBalance, accountNumber, bankName, description } = req.body;

        if (!name || !type) {
            throw createHttpError(400, "Account name and type are required");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Account } = models;
            
            return await Account.create({
                businessId,
                name,
                type,
                openingBalance: openingBalance || 0,
                currentBalance: openingBalance || 0,
                accountNumber,
                bankName,
                description,
                isActive: true
            }, { transaction });
        });

        res.status(201).json({ success: true, data: result, message: "Account created" });
    } catch (error) {
        next(error);
    }
};

/**
 * Get all accounts
 */
exports.getAccounts = async (req, res, next) => {
    try {
        const { businessId } = req;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { Account } = models;
            
            return await Account.findAll({
                where: { businessId },
                order: [['name', 'ASC']]
            });
        });

        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};

/**
 * Add transaction
 */
exports.addTransaction = async (req, res, next) => {
    try {
        const { businessId, outletId } = req;
        const { accountId, type, amount, description, category, referenceType, referenceId, date } = req.body;

        if (!accountId || !type || !amount) {
            throw createHttpError(400, "Account ID, type, and amount are required");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Account, AccountTransaction } = models;
            
            // Verify account exists
            const account = await Account.findOne({
                where: { id: accountId, businessId },
                transaction
            });
            if (!account) throw createHttpError(404, "Account not found");

            // Calculate new balance
            let newBalance = Number(account.currentBalance || 0);
            const txAmount = parseFloat(amount);

            if (type === 'CREDIT' || type === 'INCOME') {
                newBalance += txAmount;
            } else if (type === 'DEBIT' || type === 'EXPENSE') {
                newBalance -= txAmount;
            }

            // Create transaction
            const tx = await AccountTransaction.create({
                businessId,
                outletId,
                accountId,
                type,
                amount: txAmount,
                description,
                category,
                referenceType,
                referenceId,
                date: date || new Date(),
                balanceAfter: newBalance,
                createdBy: req.auth?.id
            }, { transaction });

            // Update account balance
            await account.update({ currentBalance: newBalance }, { transaction });

            return { transaction: tx, account };
        });

        res.status(201).json({ success: true, data: result, message: "Transaction recorded" });
    } catch (error) {
        next(error);
    }
};

/**
 * Get transactions
 */
exports.getTransactions = async (req, res, next) => {
    try {
        const { businessId } = req;
        const { accountId, type, startDate, endDate, category } = req.query;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { AccountTransaction, Account } = models;
            
            const whereClause = { businessId };
            if (accountId) whereClause.accountId = accountId;
            if (type) whereClause.type = type;
            if (category) whereClause.category = category;
            if (startDate && endDate) {
                whereClause.date = { [Op.between]: [new Date(startDate), new Date(endDate)] };
            }

            return await AccountTransaction.findAll({
                where: whereClause,
                include: [{ model: Account, attributes: ['id', 'name', 'type'] }],
                order: [['date', 'DESC'], ['createdAt', 'DESC']]
            });
        });

        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};
