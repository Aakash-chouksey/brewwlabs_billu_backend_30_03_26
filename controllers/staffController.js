/**
 * STAFF CONTROLLER - Neon-Safe Transaction Pattern
 * Matches frontend API calls from StaffMaster.jsx
 */

const createHttpError = require("http-errors");
const bcrypt = require("bcryptjs");
const { safeQuery } = require("../utils/safeQuery");

/**
 * Get all staff/users
 * GET /api/tenant/staff
 * GET /api/tenant/users
 */
exports.getStaff = async (req, res, next) => {
    try {
        const { businessId } = req;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { User, Outlet } = models;
            
            return await safeQuery(
                () => User.findAll({
                    where: { businessId },
                    include: [{ model: Outlet, attributes: ['id', 'name'] }],
                    attributes: { exclude: ['password'] }
                }),
                []
            );
        });

        res.json({ success: true, data: result || [] });
    } catch (error) {
        next(error);
    }
};

/**
 * Create staff member
 * POST /api/tenant/staff
 */
exports.createStaff = async (req, res, next) => {
    try {
        const { businessId } = req;
        const { name, email, phone, role, password, outletId, salary } = req.body;

        if (!name || !email || !password || !role) {
            throw createHttpError(400, "Name, email, password, and role are required");
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { User } = models;
            
            // Check email uniqueness
            const existing = await User.findOne({
                where: { email },
                transaction
            });
            if (existing) throw createHttpError(409, "Email already registered");

            return await User.create({
                businessId,
                outletId,
                name,
                email,
                password: hashedPassword,
                phone,
                role,
                salary,
                isActive: true,
                isVerified: true,
                createdBy: req.auth?.id
            }, { transaction });
        });

        const { password: _, ...userWithoutPassword } = result.toJSON();
        res.status(201).json({ success: true, data: userWithoutPassword, message: "Staff created" });
    } catch (error) {
        next(error);
    }
};

/**
 * Update staff member
 * PUT /api/tenant/staff/:id
 */
exports.updateStaff = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { businessId } = req;
        const updateData = req.body;

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { User } = models;
            
            const user = await safeQuery(
                () => User.findOne({
                    where: { id, businessId },
                    transaction
                }),
                null
            );
            if (!user) throw createHttpError(404, "Staff not found");

            // Hash password if updating
            if (updateData.password) {
                updateData.password = await bcrypt.hash(updateData.password, 10);
            }

            await user.update(updateData, { transaction });
            return user;
        });

        const { password: _, ...userWithoutPassword } = result.toJSON();
        res.json({ success: true, data: userWithoutPassword, message: "Staff updated" });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete staff member
 * DELETE /api/tenant/staff/:id
 */
exports.deleteStaff = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { businessId } = req;

        await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { User, Order } = models;
            
            // Check if staff has orders
            const orders = await safeQuery(
                () => Order.count({
                    where: { staffId: id },
                    transaction
                }),
                0
            );
            if (orders > 0) {
                throw createHttpError(400, `Cannot delete staff with ${orders} orders`);
            }

            const user = await safeQuery(
                () => User.findOne({
                    where: { id, businessId },
                    transaction
                }),
                null
            );
            if (!user) throw createHttpError(404, "Staff not found");

            await user.destroy({ transaction });
        });

        res.json({ success: true, message: "Staff deleted" });
    } catch (error) {
        next(error);
    }
};

// Aliases for compatibility
exports.getUsers = exports.getStaff;
