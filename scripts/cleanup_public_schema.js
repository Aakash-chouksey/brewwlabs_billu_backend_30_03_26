const { Sequelize } = require('sequelize');
require('dotenv').config();

async function cleanupPublicSchema() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.error('DATABASE_URL not set');
        process.exit(1);
    }

    // Process URL for Neon compatibility
    let processedUrl = databaseUrl;
    processedUrl = processedUrl.replace(/([&?])channel_binding=require(&?)/, (match, prefix, suffix) => {
      return prefix === '?' && suffix ? '?' : prefix === '&' && suffix ? '&' : '';
    });

    const sequelize = new Sequelize(processedUrl, {
        dialect: 'postgres',
        logging: false,
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false
            }
        }
    });

    // Models that are ALLOWED in public (Strict Control Plane)
    const publicTables = [
        'users',
        'businesses',
        'auth', // used by some auth systems
        'tenant_connections',
        'plans',
        'subscriptions',
        'super_admin_users',
        'cluster_metadata',
        'tenant_migration_log',
        'audit_logs',
        'membership_plans',
        'partner_types',
        'partner_memberships',
        'partner_wallets',
        'feature_flags',
        'web_contents',
        // System tables
        'pg_stat_statements'
    ];

    try {
        console.log('🔌 Connecting to database...');
        await sequelize.authenticate();
        console.log('✅ Connected');

        // Get all tables in public schema
        const [tables] = await sequelize.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
        `);

        const tablesToDrop = tables
            .map(t => t.table_name)
            .filter(name => !publicTables.includes(name));

        if (tablesToDrop.length === 0) {
            console.log('✨ Public schema is already clean. No tenant tables found.');
            return;
        }

        console.log(`⚠️ FOUND ${tablesToDrop.length} TENANT TABLES IN PUBLIC SCHEMA:`);
        console.log(tablesToDrop.join(', '));

        const isDryRun = process.argv.includes('--dry-run');
        if (isDryRun) {
            console.log('\n🔍 DRY RUN: No tables were dropped.');
            return;
        }

        console.log('\n🔥 DROPPING TENANT TABLES FROM PUBLIC SCHEMA...');
        for (const table of tablesToDrop) {
            try {
                process.stdout.write(`  - Dropping ${table}... `);
                await sequelize.query(`DROP TABLE IF EXISTS "public"."${table}" CASCADE`);
                console.log('✅');
            } catch (err) {
                console.log(`❌ FAILED: ${err.message}`);
            }
        }

        console.log('\n✨ CLEANUP COMPLETE. Public schema is now strictly for control-pane data.');

    } catch (error) {
        console.error('❌ Error during cleanup:', error.message);
    } finally {
        await sequelize.close();
    }
}

cleanupPublicSchema();
