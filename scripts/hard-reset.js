require('dotenv').config();
const { Client } = require('pg');

async function hardReset() {
    console.log('Starting Hard Reset of both databases...');

    // 1. Drop and recreate brewlabs_dev schema
    const devClient = new Client({ connectionString: process.env.DATABASE_URL });
    await devClient.connect();
    console.log('Dropping public schema in brewlabs_dev...');
    await devClient.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public; GRANT ALL ON SCHEMA public TO brewlabs_user;');
    await devClient.end();
    console.log('brewlabs_dev schema reset complete.');

    // 2. Drop and recreate brewlabs_control_plane schema
    const cpClient = new Client({ connectionString: process.env.CONTROL_PLANE_DATABASE_URL });
    await cpClient.connect();
    console.log('Dropping tables in brewlabs_control_plane...');
    const tables = await cpClient.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public';");
    for (let row of tables.rows) {
        await cpClient.query(`DROP TABLE IF EXISTS "${row.tablename}" CASCADE;`);
    }
    
    // Also drop enums if possible
    const enums = await cpClient.query("SELECT t.typname FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid GROUP BY t.typname;");
    for (let row of enums.rows) {
        await cpClient.query(`DROP TYPE IF EXISTS "${row.typname}" CASCADE;`);
    }
    await cpClient.end();
    console.log('brewlabs_control_plane tables and enums reset complete.');

    // 3. Sync brewlabs_dev tables
    console.log('Syncing brewlabs_dev tables...');
    process.env.DB_SYNC = 'true';
    const { sequelize, connectDB } = require('../config/database_postgres');
    await connectDB(1, 1000);
    console.log('brewlabs_dev tables synced.');

    // 4. Close connections
    await sequelize.close();
    
    console.log('Hard Reset Script finished.');
    process.exit(0);
}

hardReset().catch(e => {
    console.error(e);
    process.exit(1);
});
