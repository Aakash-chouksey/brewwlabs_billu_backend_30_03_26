const authService = require('../services/auth.service');
const config = require('../config/config');
const bcrypt = require('bcryptjs');
const createHttpError = require('http-errors');
const { safeQuery } = require('../utils/safeQuery');

/**
 * Admin login - REFACTORED to use Data-First AuthService
 */
exports.loginAdmin = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            throw createHttpError(400, "Email and password are required");
        }

        // 1. Delegate to Auth Service (Safe for Neon)
        const user = await authService.login(email, password);

        // 2. Generate tokens
        const accessToken = authService.generateAccessToken(user);
        const refreshToken = authService.generateRefreshToken(user);

        // 3. Set Cookies (Security best practice)
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
        const { businessId } = req;

        const users = await req.readWithTenant(async (context) => {
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

        res.json({ success: true, data: users || [] });
    } catch (error) {
        next(error);
    }
};

/**
 * Create user
 */
exports.createUser = async (req, res, next) => {
    try {
        const { businessId } = req;
        const { name, email, password, role, outletId, phone } = req.body;

        if (!name || !email || !password || !role) {
            throw createHttpError(400, "Name, email, password, and role are required");
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { User } = models;
            
            // Check email uniqueness
            const existing = await safeQuery(
                () => User.findOne({
                    where: { email },
                    transaction
                }),
                null
            );
            if (existing) throw createHttpError(409, "Email already registered");

            return await User.create({
                businessId,
                outletId,
                name,
                email,
                password: hashedPassword,
                role,
                phone,
                isActive: true,
                isVerified: true,
                createdBy: req.auth?.id
            }, { transaction });
        });

        const { password: _, ...userWithoutPassword } = result.toJSON();
        res.status(201).json({ success: true, data: userWithoutPassword, message: "User created" });
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
            if (!user) throw createHttpError(404, "User not found");

            // Hash password if updating
            if (updateData.password) {
                updateData.password = await bcrypt.hash(updateData.password, 10);
            }

            await user.update(updateData, { transaction });
            return user;
        });

        const { password: _, ...userWithoutPassword } = result.toJSON();
        res.json({ success: true, data: userWithoutPassword, message: "User updated" });
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
        const { businessId } = req;

        await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { User } = models;
            
            const user = await safeQuery(
                () => User.findOne({
                    where: { id, businessId },
                    transaction
                }),
                null
            );
            if (!user) throw createHttpError(404, "User not found");

            await user.destroy({ transaction });
        });

        res.json({ success: true, message: "User deleted" });
    } catch (error) {
        next(error);
    }
};
