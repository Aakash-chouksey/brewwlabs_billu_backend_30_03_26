/**
 * BUSINESS CONTROLLER - Neon-Safe Version
 * Standardized for transaction-scoped model access
 */

const businessController = {
    /**
     * Get business info
     */
    getBusinessInfo: async (req, res, next) => {
        try {
            const business_id = req.business_id || req.businessId;

            const result = await req.readWithTenant(async (context) => {
                const { transactionModels: models } = context;
                const { Business } = models;
                
                return await Business.findOne({
                    where: { id: business_id },
                    attributes: ['id', 'name', 'email', 'phone', 'address', 'gstNumber', 'status', 'created_at']
                });
            });

            const business = result.data || result;
            
            if (!business) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Business not found' 
                });
            }

            res.json({ 
                success: true, 
                data: business,
                message: "Business information retrieved successfully"
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Update business info
     */
    updateBusinessInfo: async (req, res, next) => {
        try {
            const business_id = req.business_id || req.businessId;
            const updateData = req.body;

            const updated = await req.executeWithTenant(async (context) => {
                const { transaction, transactionModels: models } = context;
                const { Business } = models;

                const business = await Business.findOne({
                    where: { id: business_id },
                    transaction
                });

                if (!business) {
                    throw new Error('Business not found');
                }

                // Remove sensitive/read-only fields
                delete updateData.id;
                delete updateData.status;

                return await business.update(updateData, { transaction });
            });

            const data = updated.data || updated;

            res.json({
                success: true,
                message: 'Business profile updated successfully',
                data: data
            });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = businessController;
