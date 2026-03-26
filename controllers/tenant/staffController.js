const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const createHttpError = require('http-errors');

/**
 * Staff Controller
 * Neon-safe staff/user management using the new middleware-driven transaction pattern
 */
const staffController = {
    /**
     * Get all users/staff
     */
    getUsers: async (req, res, next) => {
        try {
            const businessId = req.businessId;

            if (!businessId) {
                throw createHttpError(400, 'Business ID not found in request');
            }

            const users = await req.readWithTenant(async (context) => {
                const { transactionModels: models } = context;
                const { User } = models;

                return await User.findAll({
                    where: { businessId },
                    attributes: ['id', 'name', 'email', 'phone', 'role', 'outletId', 'isActive', 'createdAt', 'lastLogin'],
                    order: [['created_at', 'DESC']]
                });
            });

            res.json({
                success: true,
                data: users
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Create staff/user
     */
    createStaff: async (req, res, next) => {
        try {
            const user = req.user || req.auth;
            const { name, email, phone, role, password, outletId } = req.body;
            const businessId = user.businessId;

            if (!name || !email || !password) {
                throw createHttpError(400, 'Name, email, and password are required');
            }

            const result = await req.executeWithTenant(async (context) => {
                const { transaction, transactionModels: models } = context;
                const { User } = models;

                // Check if email already exists
                const existing = await User.findOne({
                    where: { email },
                    transaction
                });

                if (existing) {
                    throw createHttpError(409, 'User with this email already exists');
                }

                // Hash password
                const hashedPassword = await bcrypt.hash(password, 10);

                const newUser = await User.create({
                    id: uuidv4(),
                    name,
                    email,
                    phone,
                    password: hashedPassword,
                    role: role || 'Staff',
                    panelType: 'TENANT',
                    businessId,
                    outletId,
                    isActive: true,
                    isVerified: true,
                    tokenVersion: 0
                }, { transaction });

                return {
                    id: newUser.id,
                    name: newUser.name,
                    email: newUser.email,
                    role: newUser.role,
                    outletId: newUser.outletId
                };
            });

            res.status(201).json({
                success: true,
                message: 'Staff created successfully',
                data: result
            });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = staffController;
