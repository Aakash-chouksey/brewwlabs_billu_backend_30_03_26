const authService = require('../../services/authService');
const bcrypt = require('bcryptjs');
const createHttpError = require('http-errors');

/**
 * Admin login - REFACTORED to use Data-First AuthService
 */
exports.loginAdmin = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            throw createHttpError(400, "Email and password are required");
        }

        const user = await authService.login(email, password);

        const accessToken = authService.generateAccessToken(user);
        const refreshToken = authService.generateRefreshToken(user);

        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
            path: '/'
        };

        res.cookie('accessToken', accessToken, {
            ...cookieOptions,
            maxAge: 60 * 60 * 1000 // 1 hour
        });

        res.cookie('refreshToken', refreshToken, {
            ...cookieOptions,
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.json({
            success: true,
            message: "Login successful",
            data: {
                user,
                accessToken,
                refreshToken
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get all users for business
 */
exports.getUsers = async (req, res, next) => {
    try {
        const business_id = req.business_id || req.businessId;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { User, Outlet } = models;
            
            return await User.findAll({
                where: { businessId: business_id },
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
            message: "Users retrieved successfully"
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Create user
 */
exports.createUser = async (req, res, next) => {
    try {
        const business_id = req.business_id || req.businessId;
        const { name, email, password, role, outletId, phone } = req.body;

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
                businessId: business_id,
                outletId: outletId || null,
                name,
                email,
                password: hashedPassword,
                role,
                phone,
                isActive: true,
                isVerified: true,
                createdBy: req.user?.id
            }, { transaction });
        });

        const user = result.data || result;
        const { password: _, ...userWithoutPassword } = user.toJSON();
        
        res.status(201).json({ 
            success: true, 
            data: userWithoutPassword, 
            message: "User created successfully" 
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update user
 */
exports.updateUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const business_id = req.business_id || req.businessId;
        const updateData = req.body;

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { User } = models;
            
            const user = await User.findOne({
                where: { id, businessId: business_id },
                transaction
            });
            if (!user) throw createHttpError(404, "User not found");

            // Hash password if updating
            if (updateData.password) {
                updateData.password = await bcrypt.hash(updateData.password, 10);
            }

            // Remove sensitive fields from updateData
            delete updateData.email; // Email should be updated via special endpoint if needed
            delete updateData.businessId;

            await user.update(updateData, { transaction });
            return user;
        });

        const user = result.data || result;
        const { password: _, ...userWithoutPassword } = user.toJSON();
        res.json({ 
            success: true, 
            data: userWithoutPassword, 
            message: "User updated successfully" 
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete user
 */
exports.deleteUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const business_id = req.business_id || req.businessId;

        await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { User } = models;
            
            const user = await User.findOne({
                where: { id, businessId: business_id },
                transaction
            });
            if (!user) throw createHttpError(404, "User not found");

            // Prevent self-deletion
            if (user.id === req.user?.id) {
                throw createHttpError(403, "You cannot delete your own account");
            }

            await user.destroy({ transaction });
        });

        res.json({ 
            success: true, 
            message: "User deleted successfully" 
        });
    } catch (error) {
        next(error);
    }
};
