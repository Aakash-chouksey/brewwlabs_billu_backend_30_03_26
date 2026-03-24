/**
 * NEON-SAFE CONTROLLER EXAMPLE
 * 
 * This example shows the CORRECT way to write controllers for Neon
 * ALL database operations must use req.executeWithTenant()
 */

const createHttpError = require("http-errors");

// ❌ OLD UNSAFE PATTERN (DO NOT USE)
/*
const createCustomerOld = async (req, res, next) => {
    try {
        // DANGEROUS: Direct model access without transaction
        const customer = await req.models.Customer.create(req.body);
        
        res.status(201).json({
            success: true,
            data: customer
        });
    } catch (error) {
        next(error);
    }
};
*/

// ✅ NEW NEON-SAFE PATTERN (REQUIRED)
const createCustomer = async (req, res, next) => {
    try {
        const { businessId, outletId } = req;
        const { name, phone, email, address } = req.body;
        
        if (!name || !phone) {
            throw createHttpError(400, "Name and phone are required");
        }

        // ✅ SAFE: All operations within transaction with schema switching
        const result = await req.executeWithTenant(async (transaction, context) => {
            const { Customer, CustomerLedger } = req.models;
            
            // Check for existing customer (within transaction)
            const existingCustomer = await Customer.findOne({
                where: { 
                    businessId, 
                    outletId, 
                    phone: phone.trim() 
                },
                transaction
            });

            if (existingCustomer) {
                return {
                    exists: true,
                    data: existingCustomer
                };
            }

            // Create new customer (within transaction)
            const customer = await Customer.create({
                businessId,
                outletId,
                name: name.trim(),
                phone: phone.trim(),
                email: email?.trim() || null,
                address: address?.trim() || null
            }, { transaction });

            // Create initial ledger entry (within transaction)
            const ledgerEntry = await CustomerLedger.create({
                businessId,
                outletId,
                customerId: customer.id,
                transactionType: 'OPENING_BALANCE',
                amount: 0,
                balance: 0,
                description: 'Customer account opened'
            }, { transaction });

            return {
                exists: false,
                data: {
                    customer,
                    ledgerEntry
                }
            };
        });

        if (result.success && result.data.exists) {
            return res.status(200).json({ 
                success: true, 
                data: result.data.data,
                message: "Customer already exists" 
            });
        }

        if (result.success) {
            return res.status(201).json({ 
                success: true, 
                data: result.data.data.customer,
                message: "Customer created successfully" 
            });
        }

        throw new Error(result.error || 'Failed to create customer');

    } catch (error) {
        next(error);
    }
};

// ✅ READ-ONLY OPERATION EXAMPLE
const getCustomers = async (req, res, next) => {
    try {
        const { businessId, outletId } = req;
        const { page = 1, limit = 20, search } = req.query;

        // ✅ SAFE: Read-only operation with optimization
        const result = await req.readWithTenant(async (transaction) => {
            const { Customer } = req.models;
            
            const whereClause = { businessId, outletId };
            
            if (search) {
                whereClause[Op.or] = [
                    { name: { [Op.iLike]: `%${search}%` } },
                    { phone: { [Op.iLike]: `%${search}%` } },
                    { email: { [Op.iLike]: `%${search}%` } }
                ];
            }

            const offset = (parseInt(page) - 1) * parseInt(limit);
            
            const { count, rows } = await Customer.findAndCountAll({
                where: whereClause,
                limit: parseInt(limit),
                offset,
                order: [['createdAt', 'DESC']],
                transaction
            });

            return {
                customers: rows,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: count,
                    pages: Math.ceil(count / parseInt(limit))
                }
            };
        });

        if (result.success) {
            return res.status(200).json({
                success: true,
                data: result.data
            });
        }

        throw new Error(result.error || 'Failed to fetch customers');

    } catch (error) {
        next(error);
    }
};

// ✅ BATCH OPERATION EXAMPLE
const bulkCreateCustomers = async (req, res, next) => {
    try {
        const { businessId, outletId } = req;
        const { customers } = req.body; // Array of customer objects

        if (!Array.isArray(customers) || customers.length === 0) {
            throw createHttpError(400, "Customers array is required");
        }

        // ✅ SAFE: Batch operations within single transaction
        const result = await req.batchWithTenant(customers.map((customerData, index) => {
            return async (transaction) => {
                const { Customer } = req.models;
                
                // Validate customer data
                if (!customerData.name || !customerData.phone) {
                    throw new Error(`Customer at index ${index}: Name and phone are required`);
                }

                // Check for duplicates
                const existing = await Customer.findOne({
                    where: {
                        businessId,
                        outletId,
                        phone: customerData.phone.trim()
                    },
                    transaction
                });

                if (existing) {
                    return {
                        index,
                        exists: true,
                        data: existing,
                        message: `Customer at index ${index} already exists`
                    };
                }

                // Create customer
                const customer = await Customer.create({
                    businessId,
                    outletId,
                    name: customerData.name.trim(),
                    phone: customerData.phone.trim(),
                    email: customerData.email?.trim() || null,
                    address: customerData.address?.trim() || null
                }, { transaction });

                return {
                    index,
                    exists: false,
                    data: customer,
                    message: `Customer at index ${index} created successfully`
                };
            };
        }));

        if (result.success) {
            const { successfulOperations, failedOperations } = result.data;
            
            return res.status(200).json({
                success: true,
                data: {
                    created: successfulOperations,
                    failed: failedOperations,
                    summary: {
                        total: customers.length,
                        successful: successfulOperations.length,
                        failed: failedOperations.length
                    }
                }
            });
        }

        throw new Error(result.error || 'Failed to bulk create customers');

    } catch (error) {
        next(error);
    }
};

// ✅ UPDATE OPERATION EXAMPLE
const updateCustomer = async (req, res, next) => {
    try {
        const { businessId, outletId } = req;
        const { id } = req.params;
        const { name, phone, email, address } = req.body;

        if (!id) {
            throw createHttpError(400, "Customer ID is required");
        }

        // ✅ SAFE: Write operation with proper isolation
        const result = await req.writeWithTenant(async (transaction) => {
            const { Customer } = req.models;
            
            // Find customer first
            const customer = await Customer.findOne({
                where: { id, businessId, outletId },
                transaction
            });

            if (!customer) {
                throw new Error("Customer not found");
            }

            // Update customer
            const updatedCustomer = await customer.update({
                name: name?.trim() || customer.name,
                phone: phone?.trim() || customer.phone,
                email: email?.trim() || customer.email,
                address: address?.trim() || customer.address
            }, { transaction });

            return updatedCustomer;
        });

        if (result.success) {
            return res.status(200).json({
                success: true,
                data: result.data,
                message: "Customer updated successfully"
            });
        }

        throw new Error(result.error || 'Failed to update customer');

    } catch (error) {
        next(error);
    }
};

module.exports = {
    createCustomer,
    getCustomers,
    bulkCreateCustomers,
    updateCustomer
};
