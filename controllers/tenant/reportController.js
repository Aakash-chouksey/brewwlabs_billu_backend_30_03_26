const { enforceOutletScope, buildStrictWhereClause } = require("../../utils/outletGuard");
const { Op, Sequelize } = require("sequelize");

/**
 * REPORT CONTROLLER - Neon-Safe Transaction Pattern
 */

/**
 * Get daily sales report
 */
exports.getDailySales = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const business_id = req.business_id || req.businessId;
        const { date } = req.query;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { Order, OrderItem, Product } = models;
            
            const { whereClause } = buildStrictWhereClause(req, { status: 'COMPLETED' });

            const targetDate = date ? new Date(date) : new Date();
            targetDate.setHours(0, 0, 0, 0);
            const nextDate = new Date(targetDate);
            nextDate.setDate(nextDate.getDate() + 1);

            whereClause.createdAt = { [Op.between]: [targetDate, nextDate] };

            const orders = await Order.findAll({
                where: whereClause,
                include: [{ 
                    model: OrderItem, 
                    as: 'items', 
                    include: [{ model: Product, as: 'product' }] 
                }]
            });

            const totalSales = orders.reduce((sum, o) => sum + Number(o.billingTotal || 0), 0);
            const totalOrders = orders.length;
            const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

            const hourlySales = {};
            orders.forEach(order => {
                const hour = new Date(order.createdAt).getHours();
                if (!hourlySales[hour]) hourlySales[hour] = { count: 0, sales: 0 };
                hourlySales[hour].count++;
                hourlySales[hour].sales += Number(order.billingTotal || 0);
            });

            return {
                date: targetDate.toISOString().split('T')[0],
                totalSales: Math.round(totalSales * 100) / 100,
                totalOrders,
                avgOrderValue: Math.round(avgOrderValue * 100) / 100,
                hourlySales
            };
        });

        const data = result.data || result;
        
        return res.json({ 
            success: true, 
            data: data,
            message: "Daily sales report retrieved successfully"
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get item-wise sales report
 */
exports.getItemWiseSales = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const business_id = req.business_id || req.businessId;
        const { startDate, endDate } = req.query;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { OrderItem, Order, Product } = models;
            
            const { outletId: outlet_id } = buildStrictWhereClause(req);
            const orderWhereClause = { status: 'COMPLETED' };
            
            if (outlet_id) {
                orderWhereClause.outletId = outlet_id;
            }

            const dateRange = {};
            if (startDate && endDate) {
                dateRange.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
            }

            const items = await OrderItem.findAll({
                where: dateRange,
                include: [
                    {
                        model: Order,
                        as: 'order',
                        where: orderWhereClause,
                        attributes: ['id', 'status', 'createdAt']
                    },
                    {
                        model: Product,
                        as: 'product',
                        where: { businessId: business_id },
                        attributes: ['id', 'name', 'categoryId']
                    }
                ]
            });

            const productSales = {};
            items.forEach(item => {
                const product = item.product;
                if (!product) return;
                
                const pid = item.productId;
                if (!productSales[pid]) {
                    productSales[pid] = {
                        productId: pid,
                        name: product.name,
                        totalQuantity: 0,
                        totalRevenue: 0,
                        orders: 0
                    };
                }
                productSales[pid].totalQuantity += Number(item.quantity || 0);
                productSales[pid].totalRevenue += Number(item.total || 0);
                productSales[pid].orders++;
            });

            return Object.values(productSales).sort((a, b) => b.totalRevenue - a.totalRevenue);
        });

        const data = result.data || result || [];
        
        return res.json({ 
            success: true, 
            data: data,
            message: "Item-wise sales report retrieved successfully"
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get system stats (SuperAdmin only)
 */
exports.getSystemStats = async (req, res, next) => {
    try {
        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { Business, User, Order } = models;
            
            const totalBusinesses = await Business.count();
            const totalUsers = await User.count();
            const todayOrders = await Order.count({
                where: {
                    createdAt: { [Op.gte]: new Date(new Date().setHours(0,0,0,0)) }
                }
            });

            return {
                totalBusinesses,
                totalUsers,
                todayOrders
            };
        });

        const data = result.data || result;
        
        return res.json({ 
            success: true, 
            data: data,
            message: "System statistics retrieved successfully"
        });
    } catch (error) {
        next(error);
    }
};
/**
 * Get aggregated reports overview
 */
exports.getReportsOverview = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const business_id = req.business_id || req.businessId;
        const { period = 'today', outletId } = req.query;

        console.log(`🔍 [ReportController] Getting overview report | Business: ${business_id} | Outlet: ${outletId} | Period: ${period}`);

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { Order, OrderItem, Product, Category, Customer } = models;
            // Safely get optional models
            const InventoryItem = models.InventoryItem || null;
            const Wastage = models.Wastage || null;
            
            const { whereClause: baseWhere } = buildStrictWhereClause(req, { status: 'COMPLETED' });
            
            // Build date range based on period
            const now = new Date();
            let startDate = new Date();
            startDate.setHours(0, 0, 0, 0);

            if (period === 'week') {
                const day = now.getDay();
                startDate.setDate(now.getDate() - day);
            } else if (period === 'month') {
                startDate.setDate(1);
            } else if (period === 'quarter') {
                const month = now.getMonth();
                startDate.setMonth(month - (month % 3));
                startDate.setDate(1);
            } else if (period === 'year') {
                startDate.setMonth(0);
                startDate.setDate(1);
            }

            const dateWhere = { ...baseWhere, createdAt: { [Op.gte]: startDate } };

            // 1. OVERVIEW STATS
            const orders = await Order.findAll({
                where: dateWhere,
                attributes: ['billingTotal', 'id']
            });

            const totalRevenue = orders.reduce((sum, o) => sum + Number(o.billingTotal || 0), 0);
            const totalOrders = orders.length;
            const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
            const uniqueCustomers = await Customer.count({ 
                where: { businessId: business_id, ...(outletId && { outletId }) } 
            });

            // 2. SALES BY CATEGORY & ITEM
            const orderItems = await OrderItem.findAll({
                include: [
                    {
                        model: Order,
                        as: 'order',
                        where: dateWhere,
                        attributes: []
                    },
                    {
                        model: Product,
                        as: 'product',
                        attributes: ['id', 'name'],
                        include: [{ model: Category, as: 'category', attributes: ['name'] }]
                    }
                ]
            });

            const categorySales = {};
            const itemSales = {};

            orderItems.forEach(item => {
                const prod = item.product;
                if (!prod) return;

                // Category aggregate
                const catName = prod.category?.name || 'Uncategorized';
                if (!categorySales[catName]) categorySales[catName] = { category: catName, orders: 0, revenue: 0 };
                categorySales[catName].orders++;
                categorySales[catName].revenue += Number(item.total || 0);

                // Item aggregate
                const prodName = prod.name;
                if (!itemSales[prodName]) itemSales[prodName] = { name: prodName, quantity: 0, revenue: 0 };
                itemSales[prodName].quantity += Number(item.quantity || 0);
                itemSales[prodName].revenue += Number(item.total || 0);
            });

            // 3. INVENTORY HEALTH - Handle missing models gracefully
            let lowStockItems = [];
            let recentWastage = [];
            
            try {
                if (InventoryItem) {
                    lowStockItems = await InventoryItem.findAll({
                        where: { 
                            businessId: business_id, 
                            ...(outletId && { outletId }),
                            currentStock: { [Op.lte]: Sequelize.col('minimum_stock') }
                        },
                        attributes: ['name', 'currentStock', 'minimumStock', 'unit'],
                        limit: 10
                    });
                }
            } catch (error) {
                console.warn('⚠️ [ReportController] Could not fetch low stock items:', error.message);
            }
            
            try {
                if (Wastage && InventoryItem) {
                    recentWastage = await Wastage.findAll({
                        where: { businessId: business_id, ...(outletId && { outletId }) },
                        include: [{ model: InventoryItem, as: 'inventoryItem', attributes: ['name'] }],
                        order: [['createdAt', 'DESC']],
                        limit: 5
                    });
                }
            } catch (error) {
                console.warn('⚠️ [ReportController] Could not fetch wastage data:', error.message);
            }

            return {
                overview: {
                    totalRevenue: Math.round(totalRevenue * 100) / 100,
                    totalOrders,
                    averageOrderValue: Math.round(avgOrderValue * 100) / 100,
                    customerCount: uniqueCustomers
                },
                sales: {
                    byCategory: Object.values(categorySales).sort((a, b) => b.revenue - a.revenue),
                    byItem: Object.values(itemSales).sort((a, b) => b.revenue - a.revenue).slice(0, 10),
                    payments: [] // Add payment summary support later
                },
                inventory: {
                    lowStock: lowStockItems.map(i => ({ 
                        name: i.name, 
                        current: i.currentStock, 
                        min: i.minimumStock, 
                        unit: i.unit 
                    })),
                    wastage: recentWastage.map(w => ({
                        item: w.inventoryItem?.name || w.reason, 
                        reason: w.reason,
                        cost: w.costValue
                    }))
                }
            };
        });

        const data = result.data || result;
        console.log(`✅ [ReportController] Overview report generated successfully`);
        
        return res.json({ 
            success: true, 
            data: data,
            message: "Reports overview retrieved successfully"
        });
    } catch (error) {
        console.error(`🚨 [ReportController] Error generating overview report:`, error);
        next(error);
    }
};
