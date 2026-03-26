/**
 * 🔍 NEON MULTI-TENANT DATABASE INSPECTOR
 * 
 * Visualization and validation tool for schema-per-tenant architecture.
 */

const { Client } = require('pg');
require('dotenv').config();

// Configuration
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URI;
const args = process.argv.slice(2);

// CLI Flags
const schemaFilter = args.find(a => a.startsWith('--schema='))?.split('=')[1];
const checkOnly = args.includes('--check');
const summaryOnly = args.includes('--summary');

if (!connectionString) {
    console.error('❌ Error: DATABASE_URL environment variable is not set.');
    process.exit(1);
}

// Colors for terminal output
const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
};

async function inspect() {
    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // 1. Fetch All Schemas
        const schemaRes = await client.query(`
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name = 'public' OR schema_name LIKE 'tenant_%'
            ORDER BY schema_name
        `);
        const schemas = schemaRes.rows.map(r => r.schema_name);

        // 2. Fetch All Tables
        const tableRes = await client.query(`
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' OR table_schema LIKE 'tenant_%'
            AND table_type = 'BASE TABLE'
            ORDER BY table_schema, table_name
        `);
        
        const tablesBySchema = {};
        tableRes.rows.forEach(row => {
            if (!tablesBySchema[row.table_schema]) {
                tablesBySchema[row.table_schema] = [];
            }
            tablesBySchema[row.table_schema].push(row.table_name);
        });

        // 3. Fetch Tenant Registry for validation
        let registeredTenants = [];
        try {
            const registryRes = await client.query('SELECT schema_name FROM public.tenant_registry');
            registeredTenants = registryRes.rows.map(r => r.schema_name);
        } catch (e) {
            // Registry might not exist yet or error in query
        }

        if (summaryOnly) {
            printSummary(schemas, tablesBySchema);
            return;
        }

        if (schemaFilter) {
            await inspectSpecificSchema(client, schemaFilter);
            return;
        }

        console.log(`\n${colors.bright}=== DATABASE SCHEMAS ===${colors.reset}\n`);

        for (const schema of schemas) {
            const isPublic = schema === 'public';
            const icon = isPublic ? '📦' : '🏪';
            const label = isPublic ? '(CONTROL PLANE)' : '(MULTI-TENANT)';
            const color = isPublic ? colors.cyan : colors.green;

            console.log(`${icon} ${color}${colors.bright}${schema}${colors.reset} ${colors.dim}${label}${colors.reset}`);
            
            const tables = tablesBySchema[schema] || [];
            if (tables.length === 0) {
                console.log(`   ${colors.yellow}⚠️  No tables found in this schema${colors.reset}`);
            } else {
                tables.forEach((table, index) => {
                    const prefix = index === tables.length - 1 ? '└──' : '├──';
                    console.log(`   ${prefix} ${table}`);
                });
            }
            console.log('');
        }

        printSummary(schemas, tablesBySchema);

        if (checkOnly || true) {
            runValidation(schemas, tablesBySchema, registeredTenants);
        }

    } catch (error) {
        console.error(`${colors.red}❌ Database Error:${colors.reset}`, error.message);
    } finally {
        await client.end();
    }
}

async function inspectSpecificSchema(client, schemaName) {
    console.log(`\n${colors.bright}🔍 Inspecting Schema: ${colors.green}${schemaName}${colors.reset}\n`);

    const colRes = await client.query(`
        SELECT table_name, column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = $1
        ORDER BY table_name, ordinal_position
    `, [schemaName]);

    if (colRes.rows.length === 0) {
        console.log(`${colors.yellow}No tables or columns found in schema "${schemaName}".${colors.reset}`);
        return;
    }

    let currentTable = '';
    colRes.rows.forEach(row => {
        if (row.table_name !== currentTable) {
            currentTable = row.table_name;
            console.log(`\n📋 Table: ${colors.bright}${currentTable}${colors.reset}`);
        }
        const nullable = row.is_nullable === 'YES' ? '' : `${colors.red}*${colors.reset}`;
        console.log(`   ├── ${row.column_name.padEnd(20)} ${colors.dim}${row.data_type}${colors.reset}${nullable}`);
    });
    console.log('');
}

function printSummary(schemas, tablesBySchema) {
    const tenantCount = schemas.filter(s => s.startsWith('tenant_')).length;
    const avgTables = tenantCount > 0 
        ? Math.round(schemas.filter(s => s.startsWith('tenant_'))
            .reduce((acc, s) => acc + (tablesBySchema[s]?.length || 0), 0) / tenantCount)
        : 0;

    console.log(`${colors.bright}=== SUMMARY ===${colors.reset}`);
    console.log(`Total Schemas:    ${schemas.length}`);
    console.log(`Total Tenants:    ${tenantCount}`);
    console.log(`Tables per Tenant: ~${avgTables}`);
    console.log('');
}

function runValidation(schemas, tablesBySchema, registeredTenants) {
    let issues = 0;
    console.log(`${colors.bright}=== VALIDATION CHECKS ===${colors.reset}`);

    // 1. Check for tenant tables in public
    const tenantTablePatterns = ['orders', 'products', 'inventory', 'tables', 'outlets', 'sessions', 'order_items'];
    const publicTables = tablesBySchema['public'] || [];
    const misplaced = publicTables.filter(t => tenantTablePatterns.includes(t.toLowerCase()));

    if (misplaced.length > 0) {
        console.log(`${colors.red}❌ ERROR:${colors.reset} Tenant tables found in public schema: ${misplaced.join(', ')}`);
        issues++;
    } else {
        console.log(`${colors.green}✅ OK:${colors.reset} Public schema contains only control plane tables.`);
    }

    // 2. Check for missing schemas from registry
    const missingInDb = registeredTenants.filter(t => !schemas.includes(t));
    if (missingInDb.length > 0) {
        console.log(`${colors.red}❌ ERROR:${colors.reset} Registered tenants missing schema in DB: ${missingInDb.join(', ')}`);
        issues++;
    } else if (registeredTenants.length > 0) {
        console.log(`${colors.green}✅ OK:${colors.reset} All registered tenants have database schemas.`);
    }

    // 3. Check for empty tenant schemas
    const emptySchemas = schemas.filter(s => s.startsWith('tenant_') && (!tablesBySchema[s] || tablesBySchema[s].length === 0));
    if (emptySchemas.length > 0) {
        console.log(`${colors.yellow}⚠️  WARNING:${colors.reset} Empty tenant schemas detected: ${emptySchemas.join(', ')}`);
        issues++;
    }

    if (issues === 0) {
        console.log(`${colors.green}✨ No issues detected. System is healthy.${colors.reset}`);
    }
    console.log('');
}

inspect();
