/**
 * TABLE CONSISTENCY CONTROLLER
 * Provides endpoints for table consistency management
 */

const TableConsistencyService = require("../../services/tableConsistencyService");

/**
 * Run consistency check for all tables
 */
exports.runConsistencyCheck = async (req, res, next) => {
    try {
        console.log(`🔧 [ConsistencyController] Starting manual consistency check | Business: ${req.businessId} | Outlet: ${req.outletId}`);
        
        const { businessId, outletId } = req;
        const { outletId: queryOutletId } = req.query;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            
            return await TableConsistencyService.runConsistencyCheck(
                models, 
                businessId, 
                queryOutletId || outletId
            );
        });

        const responseData = result.data || result;
        
        res.json({ 
            success: true, 
            data: responseData,
            message: `Consistency check completed. ${responseData.correctedTables} tables corrected out of ${responseData.totalTables} total tables.`
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get real table status based on active orders
 */
exports.getRealTableStatus = async (req, res, next) => {
    try {
        const { tableId } = req.params;
        const { businessId } = req;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            
            return await TableConsistencyService.getRealTableStatus(tableId, models);
        });

        const responseData = result.data || result;
        
        res.json({ 
            success: true, 
            data: responseData,
            message: "Real table status retrieved successfully"
        });
    } catch (error) {
        next(error);
    }
};
