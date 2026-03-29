const { sequelize } = require('../config/unified_database');

async function resetDatabase() {
  console.log('🔴 STARTING COMPLETE SYSTEM RESET...');
  const transaction = await sequelize.transaction();

  try {
    // 1. Get all tenant schemas
    const [schemas] = await sequelize.query(
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%'",
      { transaction }
    );

    for (const schema of schemas) {
      console.log(`- Dropping schema: ${schema.schema_name}`);
      await sequelize.query(`DROP SCHEMA IF EXISTS "${schema.schema_name}" CASCADE`, { transaction });
    }

    // 2. Clear public schema tables
    const [tables] = await sequelize.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' 
       AND tablename NOT LIKE 'pg_%' AND tablename NOT LIKE 'sql_%'`,
      { transaction }
    );

    for (const table of tables) {
      console.log(`- Dropping table: public.${table.tablename}`);
      await sequelize.query(`DROP TABLE IF EXISTS public."${table.tablename}" CASCADE`, { transaction });
    }

    // 3. Clear any sequences and types in public schema
    await sequelize.query(`
      DO $$
      DECLARE
          r RECORD;
      BEGIN
          -- Drop sequences
          FOR r IN (SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE relkind = 'S' AND n.nspname = 'public') LOOP
              EXECUTE 'DROP SEQUENCE IF EXISTS public.' || quote_ident(r.relname) || ' CASCADE';
          END LOOP;
          -- Drop types
          FOR r IN (SELECT typname FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND typtype = 'e') LOOP
              EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
          END LOOP;
      END $$;
    `, { transaction });

    await transaction.commit();
    console.log('✅ DATABASE RESET COMPLETE. System is now clean.');
    process.exit(0);
  } catch (error) {
    await transaction.rollback();
    console.error('❌ RESET FAILED:', error.message);
    process.exit(1);
  }
}

resetDatabase();
