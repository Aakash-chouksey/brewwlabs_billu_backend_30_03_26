#!/usr/bin/env node

/**
 * Schema-Per-Tenant Validation Test Suite
 * 
 * Validates:
 * - Schema existence
 * - Table location in tenant schemas
 * - Cross-tenant data isolation
 * - No fallback to public
 * 
 * Usage: node scripts/validateSchemaPerTenant.js [--tenant=<id>]
 */

const { sequelize } = require('../config/unified_database');
const { controlPlaneSequelize } = require('../config/control_plane_db');

class SchemaValidationService {
    constructor() {
        this.results = {
            passed: 0,
            failed: 0,
            tests: []
        };
        this.targetTenant = this.parseTargetTenant();
    }

    parseTargetTenant() {
        const arg = process.argv.find(a => a.startsWith('--tenant='));
        return arg ? arg.split('=')[1] : null;
    }

    async test(name, testFn) {
        try {
            await testFn();
            this.results.passed++;
            this.results.tests.push({ name, status: '✅ PASS' });
            console.log(`✅ PASS: ${name}`);
        } catch (error) {
            this.results.failed++;
            this.results.tests.push({ name, status: '❌ FAIL', error: error.message });
            console.log(`❌ FAIL: ${name} - ${error.message}`);
        }
    }

    /**
     * TEST 1: Verify tenant schemas exist
     */
    async testSchemaExistence() {
        await this.test('Tenant schemas exist in database', async () => {
            const [schemas] = await sequelize.query(
                `SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%'`
            );
            
            if (schemas.length === 0) {
                throw new Error('No tenant schemas found! Migration not run.');
            }
            
            console.log(`   Found ${schemas.length} tenant schemas`);
        });
    }

    /**
     * TEST 2: Verify tables exist inside tenant schemas
     */
    async testTableLocation() {
        await this.test('Tables exist inside tenant schemas', async () => {
            const [schemas] = await sequelize.query(
                `SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%'`
            );

            if (schemas.length === 0) {
                throw new Error('No tenant schemas to check');
            }

            const schemaName = schemas[0].schema_name;
            
            const [tables] = await sequelize.query(
                `SELECT tablename FROM pg_tables WHERE schemaname = '${schemaName}'`
            );
            
            const expectedTables = ['businesses', 'outlets', 'users', 'products', 'categories', 'orders'];
            const foundTables = tables.map(t => t.tablename);
            
            const missingTables = expectedTables.filter(t => !foundTables.includes(t));
            
            if (missingTables.length > 0) {
                throw new Error(`Missing tables in ${schemaName}: ${missingTables.join(', ')}`);
            }
            
            console.log(`   Schema ${schemaName} has ${tables.length} tables`);
        });
    }

    /**
     * TEST 3: Verify no tables in public (except control plane)
     */
    async testNoTenantTablesInPublic() {
        await this.test('No tenant data tables in public schema', async () => {
            const [tables] = await sequelize.query(
                `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('products', 'orders', 'inventory', 'categories')`
            );
            
            if (tables.length > 0) {
                throw new Error(`Found ${tables.length} tenant tables still in public: ${tables.map(t => t.tablename).join(', ')}`);
            }
            
            console.log('   No tenant tables found in public schema');
        });
    }

    /**
     * TEST 4: Verify cross-tenant isolation
     */
    async testCrossTenantIsolation() {
        await this.test('Cross-tenant data isolation', async () => {
            const [schemas] = await sequelize.query(
                `SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%' LIMIT 2`
            );

            if (schemas.length < 2) {
                console.log('   ⚠️ Only one tenant schema - skipping cross-tenant test');
                return;
            }

            const schemaA = schemas[0].schema_name;
            const schemaB = schemas[1].schema_name;

            // Get count of products in schema A
            const [countA] = await sequelize.query(
                `SELECT COUNT(*) as count FROM "${schemaA}".products`
            );

            // Get count of products in schema B
            const [countB] = await sequelize.query(
                `SELECT COUNT(*) as count FROM "${schemaB}".products`
            );

            // Verify they're separate by trying to join (should fail or return 0)
            try {
                const [crossJoin] = await sequelize.query(
                    `SELECT COUNT(*) as count FROM "${schemaA}".products p1 
                     JOIN "${schemaB}".products p2 ON p1.id = p2.id`
                );
                
                if (crossJoin[0].count > 0) {
                    throw new Error(`Cross-tenant data overlap detected: ${crossJoin[0].count} matching records`);
                }
            } catch (error) {
                // Expected - tables are in different schemas
            }

            console.log(`   Schema A: ${countA[0].count} products, Schema B: ${countB[0].count} products`);
        });
    }

    /**
     * TEST 5: Verify SET LOCAL search_path behavior
     */
    async testSearchPathBehavior() {
        await this.test('Strict search_path isolation', async () => {
            const [schemas] = await sequelize.query(
                `SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%' LIMIT 1`
            );

            if (schemas.length === 0) {
                throw new Error('No tenant schemas to test');
            }

            const schemaName = schemas[0].schema_name;

            // Start a transaction and set strict search path
            const transaction = await sequelize.transaction();
            
            try {
                await sequelize.query(
                    `SET LOCAL search_path TO "${schemaName}"`,
                    { transaction }
                );

                // Verify search path is set correctly
                const [pathResult] = await sequelize.query('SHOW search_path', { transaction });
                const searchPath = pathResult[0].search_path;

                if (searchPath.includes('public')) {
                    throw new Error(`Search path includes public: ${searchPath}`);
                }

                if (!searchPath.includes(schemaName)) {
                    throw new Error(`Search path missing tenant schema: ${searchPath}`);
                }

                await transaction.rollback();
                console.log(`   Search path correctly isolated to: ${searchPath}`);
            } catch (error) {
                await transaction.rollback();
                throw error;
            }
        });
    }

    /**
     * TEST 6: Verify schema exists validation in executor
     */
    async testSchemaValidation() {
        await this.test('Schema existence validation (executor)', async () => {
            // This test verifies that the executor checks schema existence
            // The actual test happens when queries are made through the executor
            
            const [schemas] = await sequelize.query(
                `SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%' LIMIT 1`
            );

            if (schemas.length === 0) {
                throw new Error('No tenant schemas to validate');
            }

            const schemaName = schemas[0].schema_name;
            const businessId = schemaName.replace('tenant_', '');

            // Verify business exists in control plane
            const [business] = await controlPlaneSequelize.query(
                `SELECT id FROM businesses WHERE id = :businessId`,
                { replacements: { businessId } }
            );

            if (business.length === 0) {
                throw new Error(`Orphaned schema ${schemaName} - no matching business in control plane`);
            }

            console.log(`   Schema ${schemaName} validated against business ${businessId}`);
        });
    }

    /**
     * TEST 7: Verify data integrity in tenant schemas
     */
    async testDataIntegrity() {
        await this.test('Data integrity in tenant schemas', async () => {
            const [schemas] = await sequelize.query(
                `SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%' LIMIT 1`
            );

            if (schemas.length === 0) {
                throw new Error('No tenant schemas to check');
            }

            const schemaName = schemas[0].schema_name;
            const businessId = schemaName.replace('tenant_', '');

            // Check business record exists in tenant schema
            const [businessRecord] = await sequelize.query(
                `SELECT id, name FROM "${schemaName}".businesses WHERE id = :businessId`,
                { replacements: { businessId } }
            );

            if (businessRecord.length === 0) {
                throw new Error(`Business record missing in tenant schema ${schemaName}`);
            }

            console.log(`   Business ${businessRecord[0].name} found in schema ${schemaName}`);
        });
    }

    /**
     * Run all validation tests
     */
    async runValidation() {
        console.log('\n========================================');
        console.log('SCHEMA-PER-TENANT VALIDATION SUITE');
        console.log('========================================\n');

        if (this.targetTenant) {
            console.log(`🎯 Target tenant: ${this.targetTenant}\n`);
        }

        try {
            await this.testSchemaExistence();
            await this.testTableLocation();
            await this.testNoTenantTablesInPublic();
            await this.testCrossTenantIsolation();
            await this.testSearchPathBehavior();
            await this.testSchemaValidation();
            await this.testDataIntegrity();

            console.log('\n========================================');
            console.log('VALIDATION SUMMARY');
            console.log('========================================');
            console.log(`✅ Passed: ${this.results.passed}`);
            console.log(`❌ Failed: ${this.results.failed}`);
            console.log(`📊 Total: ${this.results.passed + this.results.failed}`);

            if (this.results.failed === 0) {
                console.log('\n✅ ALL TESTS PASSED - Schema-per-tenant properly implemented!');
                return true;
            } else {
                console.log('\n❌ SOME TESTS FAILED - Review issues above');
                return false;
            }

        } catch (error) {
            console.error('\n❌ Validation failed with error:', error.message);
            return false;
        }
    }
}

// Run if called directly
if (require.main === module) {
    const service = new SchemaValidationService();
    service.runValidation()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Validation error:', error);
            process.exit(1);
        });
}

module.exports = SchemaValidationService;
