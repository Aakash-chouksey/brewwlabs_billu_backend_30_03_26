/**
 * Tenant Profile Controller - Neon-Safe Version
 * Standardized for transaction-scoped model access
 */

const createHttpError = require('http-errors');

const profileController = {
    /**
     * Get current user profile
     */
    getProfile: async (req, res, next) => {
        try {
            const { auth } = req;
            if (!auth) {
                throw createHttpError(401, 'User not authenticated');
            }

            const result = await req.readWithTenant(async (context) => {
                const { transactionModels: models } = context;
                const { User, Business } = models;
                
                const user = await User.findOne({
                    where: { id: auth.id }
                });

                if (!user) {
                    throw createHttpError(404, 'User not found');
                }

                const business = await Business.findOne({
                    where: { id: user.businessId }
                });

                return { user, business };
            });

            res.json({
                success: true,
                ...result
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Update user profile
     */
    updateProfile: async (req, res, next) => {
        try {
            const { auth } = req;
            const { name, phone, email } = req.body;
            
            if (!auth) {
                throw createHttpError(401, 'User not authenticated');
            }

            const updated = await req.executeWithTenant(async (context) => {
                const { transaction, transactionModels: models } = context;
                const { User } = models;
                
                const user = await User.findOne({
                    where: { id: auth.id },
                    transaction
                });

                if (!user) {
                    throw createHttpError(404, 'User not found');
                }

                const updateData = {};
                if (name) updateData.name = name;
                if (phone) updateData.phone = phone;
                if (email) updateData.email = email;

                return await user.update(updateData, { transaction });
            });

            res.json({
                success: true,
                message: 'Profile updated successfully',
                data: updated
            });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = profileController;
