#!/usr/bin/env node
/**
 * Direct migration runner - adds recovery columns to tenant_registry
 */

const { sequelize } = require('../config/unified_database');

async function runMigration() {
    console.log('🔌 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connected\n');
    
    try {
        console.log('🔧 Adding retry_count column...');
        await sequelize.query(`
            ALTER TABLE public.tenant_registry 
            ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0
        `);
        console.log('✅ retry_count column added\n');
        
        console.log('🔧 Adding last_error column...');
        await sequelize.query(`
            ALTER TABLE public.tenant_registry 
            ADD COLUMN IF NOT EXISTS last_error TEXT
        `);
        console.log('✅ last_error column added\n');
        
        console.log('🔧 Adding activated_at column...');
        await sequelize.query(`
            ALTER TABLE public.tenant_registry 
            ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP
        `);
        console.log('✅ activated_at column added\n');
        
        console.log('🎉 Migration completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        await sequelize.close();
    }
}

runMigration();
