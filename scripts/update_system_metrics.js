#!/usr/bin/env node

/**
 * 📈 SYSTEM METRICS AGGREGATION JOB
 * 
 * Aggregates data across all active tenants and caches results
 * in the public schema for the Super Admin dashboard.
 */

require('dotenv').config({ override: true });
const neonTransactionSafeExecutor = require('../services/neonTransactionSafeExecutor');
const { TenantRegistry, SystemMetrics, controlPlaneSequelize } = require('../control_plane_models');
const { CONTROL_PLANE } = require('../src/utils/constants');
const { Op } = require('sequelize');

async function updateMetrics() {
    try {
        console.log('🚀 Starting System Metrics Aggregation...');
        const startTime = Date.now();

        // 1. Fetch all active tenants
        const tenants = await TenantRegistry.findAll({
            where: { status: 'active' },
            attributes: ['businessId']
        });

        const tenantIds = tenants.map(t => t.businessId);
        console.log(`🌐 Aggregating across ${tenantIds.length} active tenants...`);

        // 2. Execute across tenants with hardened parallel executor
        const results = await neonTransactionSafeExecutor.executeAcrossTenants(
            tenantIds,
            async (transaction, context) => {
                const { Order } = transaction.models;
                if (!Order) return { totalOrders: 0, totalRevenue: 0 };

                const stats = await Order.findAll({
                    attributes: [
                        [controlPlaneSequelize.fn('COUNT', controlPlaneSequelize.col('id')), 'count'],
                        [controlPlaneSequelize.fn('SUM', controlPlaneSequelize.col('total_amount')), 'revenue']
                    ],
                    raw: true,
                    transaction
                });

                return {
                    totalOrders: parseInt(stats[0]?.count) || 0,
                    totalRevenue: parseFloat(stats[0]?.revenue) || 0
                };
            },
            { concurrency: 10, timeoutMs: 5000 }
        );

        // 3. Aggregate results
        const globalMetrics = {
            totalOrders: 0,
            totalRevenue: 0,
            tenantCount: tenantIds.length,
            successfulAggregations: results.successfulTenants,
            failedAggregations: results.failedTenants,
            aggregationTimeMs: Date.now() - startTime
        };

        results.results.forEach(res => {
            if (res.success && res.data) {
                globalMetrics.totalOrders += res.data.totalOrders;
                globalMetrics.totalRevenue += res.data.totalRevenue;
            }
        });

        // 4. Update Cache in Public Schema
        await neonTransactionSafeExecutor.executeInPublic(async (transaction) => {
            const { SystemMetrics } = transaction.models;
            
            await SystemMetrics.upsert({
                metricName: 'global_summary',
                metricValue: globalMetrics,
                lastUpdated: new Date()
            }, { transaction });
        });

        console.log('✅ Metrics Aggregation Complete:', globalMetrics);
        process.exit(0);
    } catch (error) {
        console.error('❌ Metrics Aggregation Failed:', error.message);
        process.exit(1);
    }
}

updateMetrics();
