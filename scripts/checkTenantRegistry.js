#!/usr/bin/env node
/**
 * Check tenant_registry table structure
 */

const { sequelize } = require('../config/unified_database');

async function checkTable() {
    try {
        console.log('Checking tenant_registry table structure...\n');
        
        const columns = await sequelize.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'tenant_registry'
            ORDER BY ordinal_position
        `, { type: sequelize.QueryTypes.SELECT });
        
        console.log('Columns in tenant_registry:');
        columns.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
        });
        
        // Check constraints
        const constraints = await sequelize.query(`
            SELECT constraint_name, constraint_type
            FROM information_schema.table_constraints
            WHERE table_schema = 'public' AND table_name = 'tenant_registry'
        `, { type: sequelize.QueryTypes.SELECT });
        
        console.log('\nConstraints:');
        constraints.forEach(c => {
            console.log(`  - ${c.constraint_name}: ${c.constraint_type}`);
        });
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await sequelize.close();
    }
}

checkTable();
