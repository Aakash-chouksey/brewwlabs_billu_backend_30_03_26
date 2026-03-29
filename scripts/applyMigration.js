#!/usr/bin/env node
/**
 * Apply control plane migration
 */

const { sequelize } = require('../config/unified_database');

async function applyMigration() {
    try {
        console.log('Applying migration: Adding token_version to super_admin_users...');
        
        await sequelize.query(`
            ALTER TABLE public.super_admin_users 
            ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 0
        `);
        
        console.log('✅ Migration applied successfully');
        
        // Verify
        const columns = await sequelize.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'super_admin_users'
        `, { type: sequelize.QueryTypes.SELECT });
        
        console.log('Columns in super_admin_users:', columns.map(c => c.column_name).join(', '));
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
    } finally {
        await sequelize.close();
    }
}

applyMigration();
