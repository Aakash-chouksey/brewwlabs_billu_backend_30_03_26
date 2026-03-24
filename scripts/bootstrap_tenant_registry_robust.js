#!/usr/bin/env node

require('dotenv').config({ override: true });
const { controlPlaneSequelize } = require('../config/control_plane_db');
const { DataTypes } = require('sequelize');

async function run() {
    try {
        console.log('🔄 Bootstrapping Tenant Registry...');
        
        // 1. Define Model locally for creation
        const TenantRegistry = controlPlaneSequelize.define('TenantRegistry', {
            id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
            businessId: { type: DataTypes.UUID, allowNull: false, field: 'business_id', unique: true },
            schemaName: { type: DataTypes.STRING, allowNull: false, field: 'schema_name', unique: true },
            status: { type: DataTypes.ENUM('active', 'suspended', 'onboarding', 'deleted', 'pending_approval', 'pending'), defaultValue: 'active' },
            createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: 'created_at' }
        }, {
            tableName: 'tenant_registry',
            timestamps: false,
            schema: 'public'
        });

        // 2. Sync
        await TenantRegistry.sync({ force: true });
        console.log('✅ Table tenant_registry ready in public');

        // 3. Get existing businesses
        const [businesses] = await controlPlaneSequelize.query('SELECT id, status FROM public.businesses');
        console.log(`🔍 Found ${businesses.length} businesses`);

        let createdCount = 0;
        for (const biz of businesses) {
            // Normalize status to lowercase for ENUM matching
            const status = (biz.status || 'active').toLowerCase();
            const safeStatus = ['active', 'suspended', 'onboarding', 'deleted', 'pending_approval', 'pending'].includes(status) ? status : 'active';

            const [existing] = await controlPlaneSequelize.query(`SELECT id FROM public.tenant_registry WHERE business_id = '${biz.id}' LIMIT 1`);
            
            if (existing.length === 0) {
                await controlPlaneSequelize.query(`
                    INSERT INTO public.tenant_registry (id, business_id, schema_name, status, created_at)
                    VALUES ('${require('uuid').v4()}', '${biz.id}', 'tenant_${biz.id}', '${safeStatus}', NOW())
                `);
                createdCount++;
            }
        }

        console.log(`✅ Bootstrap complete: ${createdCount} created.`);
        process.exit(0);

    } catch (error) {
        console.error('❌ Bootstrap failed:', error.message);
        process.exit(1);
    }
}

run();
