#!/usr/bin/env node
/**
 * 📈 SYSTEM METRICS AGGREGATION JOB
 * 
 * Aggregates data across all active tenants and caches results
 * in the public schema for the Super Admin dashboard.
 */

require('dotenv').config({ override: true });
const neonTransactionSafeExecutor = require('../services/neonTransactionSafeExecutor');
const controlPlaneModels = require('../control_plane_models');
const { Sequelize } = require('sequelize');

async function updateMetrics() {
    try {
        console.log('🚀 Starting System Metrics Aggregation...');
        const startTime = Date.now();

        // Initialize models first
        await controlPlaneModels.init();
        const { TenantRegistry } = controlPlaneModels;

        // 1. Fetch all active tenants
        const tenants = await TenantRegistry.findAll({
            where: { status: 'active' },
            attributes: ['businessId']
        });

        const tenantIds = tenants.map(t => t.businessId);
        console.log(`🌐 Aggregating across ${tenantIds.length} active tenants...`);

        // 2. Execute across tenants manually using readWithTenant
        const results = [];
        let successfulCount = 0;
        let failedCount = 0;

        for (const tenantId of tenantIds) {
            try {
                const tenantMetrics = await neonTransactionSafeExecutor.readWithTenant(
                    tenantId,
                    async (models) => {
                        const { Order } = models;
                        if (!Order) return { totalOrders: 0, totalRevenue: 0 };

                        // Use raw query for aggregation
                        const sequelize = Order.sequelize;
                        const [stats] = await sequelize.query(
                            `SELECT 
                                COUNT(*) as count,
                                COALESCE(SUM(total_amount), 0) as revenue
                            FROM orders
                            WHERE business_id = :tenantId`,
                            {
                                replacements: { tenantId },
                                type: Sequelize.QueryTypes.SELECT
                            }
                        );

                        return {
                            totalOrders: parseInt(stats?.count) || 0,
                            totalRevenue: parseFloat(stats?.revenue) || 0
                        };
                    }
                );

                results.push({ tenantId, success: true, data: tenantMetrics });
                successfulCount++;
            } catch (error) {
                console.error(`❌ Failed for tenant ${tenantId}:`, error.message);
                results.push({ tenantId, success: false, error: error.message });
                failedCount++;
            }
        }

        // 3. Aggregate results
        const globalMetrics = {
            totalOrders: 0,
            totalRevenue: 0,
            tenantCount: tenantIds.length,
            successfulAggregations: successfulCount,
            failedAggregations: failedCount,
            aggregationTimeMs: Date.now() - startTime
        };

        for (const res of results) {
            if (res.success && res.data) {
                globalMetrics.totalOrders += res.data.totalOrders;
                globalMetrics.totalRevenue += res.data.totalRevenue;
            }
        }

        // 4. Update Cache in Public Schema
        await neonTransactionSafeExecutor.executeInPublic(async ({ models }) => {
            await models.SystemMetrics.upsert({
                metricName: 'global_summary',
                metricValue: globalMetrics,
                lastUpdated: new Date()
            });
        });

        console.log('✅ Metrics Aggregation Complete:', globalMetrics);
        process.exit(0);
    } catch (error) {
        console.error('❌ Metrics Aggregation Failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

updateMetrics();
