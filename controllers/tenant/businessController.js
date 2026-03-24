/**
 * Business Controller - Neon-Safe Version
 * Standardized for transaction-scoped model access
 */

const businessController = {
    /**
     * Get business info
     */
    getBusinessInfo: async (req, res, next) => {
        try {
            const { businessId } = req;

            const business = await req.readWithTenant(async (context) => {
                const { transactionModels: models } = context;
                const { Business } = models;
                
                return await Business.findOne({
                    where: { id: businessId },
                    attributes: ['id', 'name', 'email', 'phone', 'address', 'gstNumber', 'logo', 'status', 'createdAt']
                });
            });

            if (!business) {
                return res.status(404).json({ success: false, message: 'Business not found' });
            }

            res.json({ success: true, data: business });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Update business info
     */
    updateBusinessInfo: async (req, res, next) => {
        try {
            const { businessId } = req;
            const { name, address, phone, email, gstNumber, logo } = req.body;

            const updated = await req.executeWithTenant(async (context) => {
                const { transaction, transactionModels: models } = context;
                const { Business } = models;

                const business = await Business.findOne({
                    where: { id: businessId },
                    transaction
                });

                if (!business) {
                    throw new Error('Business not found');
                }

                const updateData = {};
                if (name !== undefined) updateData.name = name;
                if (address !== undefined) updateData.address = address;
                if (phone !== undefined) updateData.phone = phone;
                if (email !== undefined) updateData.email = email;
                if (gstNumber !== undefined) updateData.gstNumber = gstNumber;
                if (logo !== undefined) updateData.logo = logo;

                return await business.update(updateData, { transaction });
            });

            res.json({
                success: true,
                message: 'Business info updated',
                data: updated
            });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = businessController;
