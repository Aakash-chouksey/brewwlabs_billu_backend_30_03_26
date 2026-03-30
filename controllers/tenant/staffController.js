/**
 * STAFF CONTROLLER - Neon-Safe Transaction Pattern
 */

const createHttpError = require("http-errors");
const bcrypt = require("bcryptjs");

/**
 * Get all staff/users
 */
exports.getStaff = async (req, res, next) => {
    try {
        const business_id = req.business_id || req.businessId;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { User, Outlet } = models;
            
            return await User.findAll({
                where: { business_id: business_id },
                include: [{ 
                    model: Outlet, 
                    as: 'outlet', 
                    attributes: ['id', 'name'],
                    required: false // LEFT JOIN - don't fail if outlet missing
                }],
                attributes: { exclude: ['password'] }
            });
        });

        const responseData = result.data || result || [];
        res.json({ 
            success: true, 
            data: responseData,
            message: "Staff list retrieved successfully"
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Create staff member
 */
exports.createStaff = async (req, res, next) => {
    try {
        const business_id = req.business_id || req.businessId;
        const { name, email, phone, role, password, outletId, salary } = req.body;

        if (!name || !email || !password || !role) {
            throw createHttpError(400, "Name, email, password, and role are required");
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { User } = models;
            
            const existing = await User.findOne({
                where: { email },
                transaction
            });
            if (existing) throw createHttpError(409, "Email already registered");

            return await User.create({
                businessId: business_id,
                outletId: outletId || null,
                name,
                email,
                password: hashedPassword,
                phone,
                role,
                salary: Number(salary) || 0,
                isActive: true,
                isVerified: true,
                panelType: 'TENANT'
            }, { transaction });
        });

        const staff = result.data || result;
        const { password: _, ...userWithoutPassword } = staff.toJSON();
        
        res.status(201).json({ 
            success: true, 
            data: userWithoutPassword, 
            message: "Staff created successfully" 
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update staff member
 */
exports.updateStaff = async (req, res, next) => {
    try {
        const { id } = req.params;
        const business_id = req.business_id || req.businessId;
        const updateData = req.body;

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { User } = models;
            
            const user = await User.findOne({
                where: { id, business_id: business_id },
                transaction
            });
            if (!user) throw createHttpError(404, "Staff not found");

            if (updateData.password) {
                updateData.password = await bcrypt.hash(updateData.password, 10);
            }

            // Safety deletions
            delete updateData.email;
            delete updateData.businessId;

            await user.update(updateData, { transaction });
            return user;
        });

        const staff = result.data || result;
        const { password: _, ...userWithoutPassword } = staff.toJSON();
        res.json({ 
            success: true, 
            data: userWithoutPassword, 
            message: "Staff updated successfully" 
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete staff member
 */
exports.deleteStaff = async (req, res, next) => {
    try {
        const { id } = req.params;
        const business_id = req.business_id || req.businessId;

        await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { User, Order } = models;
            
            // Check if staff has orders
            const orders = await Order.count({
                where: { staffId: id },
                transaction
            });
            if (orders > 0) {
                throw createHttpError(400, `Cannot delete staff with ${orders} active orders assigned`);
            }

            const user = await User.findOne({
                where: { id, business_id: business_id },
                transaction
            });
            if (!user) throw createHttpError(404, "Staff not found");

            if (user.id === req.user?.id) {
                throw createHttpError(403, "You cannot delete your own account");
            }

            await user.destroy({ transaction });
        });

        res.json({ 
            success: true, 
            message: "Staff deleted successfully" 
        });
    } catch (error) {
        next(error);
    }
};

// Aliases for compatibility
exports.getUsers = exports.getStaff;
