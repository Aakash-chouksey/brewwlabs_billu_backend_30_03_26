/**
 * Migration runner for audit_logs table
 * This script creates the audit_logs table in the control plane database
 */

// Load environment variables first
require('dotenv').config();

const { sequelize } = require('../config/database_postgres');

async function runAuditLogsMigration() {
    try {
        console.log('🔄 Running audit_logs migration...');
        
        // Read the migration SQL
        const fs = require('fs');
        const path = require('path');
        const migrationSQL = fs.readFileSync(
            path.join(__dirname, '../migrations/001_create_audit_logs.sql'), 
            'utf8'
        );
        
        // Execute the migration
        await sequelize.query(migrationSQL);
        
        console.log('✅ Audit logs migration completed successfully!');
        
        // Verify table exists
        const [result] = await sequelize.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'audit_logs'
        `);
        
        if (result.length > 0) {
            console.log('✅ audit_logs table verified to exist');
        } else {
            console.log('❌ audit_logs table was not created');
        }
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        await sequelize.close();
    }
}

// Run migration if called directly
if (require.main === module) {
    runAuditLogsMigration()
        .then(() => {
            console.log('🎉 Migration process completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Migration failed:', error);
            process.exit(1);
        });
}

module.exports = { runAuditLogsMigration };
