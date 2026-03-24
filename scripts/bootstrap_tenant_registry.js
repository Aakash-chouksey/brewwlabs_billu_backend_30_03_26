#!/usr/bin/env node

/**
 * 🚀 TENANT REGISTRY BOOTSTRAP SCRIPT
 * 
 * Populates the tenant_registry table from existing businesses.
 * Run this after initialize_control_plane.js.
 */

require('dotenv').config({ override: true });
const { controlPlaneSequelize, Business, TenantRegistry } = require('../control_plane_models');

async function bootstrapRegistry() {
    try {
        console.log('🔄 Bootstrapping Tenant Registry...');
        
        await controlPlaneSequelize.authenticate();
        console.log('✅ DB Connected');

        // 1. Get all businesses
        const businesses = await Business.findAll();
        console.log(`🔍 Found ${businesses.length} businesses`);

        let createdCount = 0;
        let skippedCount = 0;

        for (const business of businesses) {
            // Check if already in registry
            const existing = await TenantRegistry.findOne({ where: { businessId: business.id } });
            
            if (!existing) {
                await TenantRegistry.create({
                    businessId: business.id,
                    schemaName: `tenant_${business.id}`,
                    status: business.status || 'active'
                });
                createdCount++;
            } else {
                skippedCount++;
            }
        }

        console.log(`✅ Bootstrap complete: ${createdCount} created, ${skippedCount} skipped.`);
        process.exit(0);

    } catch (error) {
        console.error('❌ Bootstrap failed:', error.message);
        process.exit(1);
    }
}

bootstrapRegistry();
