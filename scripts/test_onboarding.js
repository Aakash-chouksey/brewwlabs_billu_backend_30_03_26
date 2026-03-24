/**
 * 🧪 ONBOARDING TEST AND VERIFICATION SCRIPT (V2)
 * 
 * Flow:
 * 1. Onboard 3 businesses via API (with unique emails)
 * 2. Verify their schemas and tables (Expect > 25 tables)
 * 3. Final PASS/FAIL report
 */

const axios = require('axios');
const { Client } = require('pg');
require('dotenv').config();

const BASE_URL = 'http://localhost:8000';
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URI;

const businessesToTest = [
    { name: 'Cafe Alpha', email: 'alpha@brewwlabs.com', admin: 'alpha_admin@brewwlabs.com' },
    { name: 'Cafe Beta', email: 'beta@brewwlabs.com', admin: 'beta_admin@brewwlabs.com' },
    { name: 'Cafe Gamma', email: 'gamma@brewwlabs.com', admin: 'gamma_admin@brewwlabs.com' }
];

async function runOnboardingTest() {
    const results = [];
    let allPassed = true;

    console.log('🚀 Starting Robust Onboarding Flow Test...\n');

    // 1. API Onboarding
    for (const biz of businessesToTest) {
        try {
            console.log(`📝 Onboarding ${biz.name}...`);
            const response = await axios.post(`${BASE_URL}/api/onboarding/business`, {
                businessName: biz.name,
                businessEmail: biz.email,
                adminName: `${biz.name} Admin`,
                adminEmail: biz.admin,
                adminPassword: 'Password123!'
            }, { timeout: 120000 });

            if (response.data.success) {
                const business = response.data.business;
                const schemaName = `tenant_${business.id}`;
                results.push({
                    name: biz.name,
                    id: business.id,
                    schema: schemaName,
                    success: true
                });
                console.log(`   ✅ API Success: ${biz.name} -> ${schemaName}`);
            } else {
                throw new Error(response.data.message || 'Onboarding response failed');
            }
        } catch (error) {
            const msg = error.response?.data?.message || error.message;
            console.error(`   ❌ Failed to onboard ${biz.name}:`, msg);
            results.push({
                name: biz.name,
                success: false,
                error: msg
            });
            allPassed = false;
        }
    }

    // 2. Database Verification
    console.log('\n🔍 Verifying Database State...\n');
    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        console.log('=== ONBOARDING VERIFICATION ===');

        for (const res of results) {
            if (!res.success) {
                console.log(`❌ ${res.name} → SKIPPED (API Failed)`);
                continue;
            }

            // A. Check table count
            const tableRes = await client.query(`
                SELECT count(*) FROM pg_tables WHERE schemaname = $1
            `, [res.schema]);
            const tableCount = parseInt(tableRes.rows[0].count);

            if (tableCount < 25) {
                console.log(`❌ ${res.name} → FAILED: Only ${tableCount} tables found (Expected > 25)`);
                allPassed = false;
            } else {
                console.log(`✅ ${res.name} → ${res.schema} (${tableCount} tables)`);
            }
        }

        // 3. Public Schema Purity Check
        console.log('\n🛡️ Checking Public Schema Purity...');
        const misplacedRes = await client.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('orders', 'products', 'inventory_items', 'outlets', 'order_items')
        `);

        if (misplacedRes.rows.length > 0) {
            console.error(`❌ FATAL: Tenant tables found in public schema: ${misplacedRes.rows.map(r => r.table_name).join(', ')}`);
            allPassed = false;
        } else {
            console.log('✅ Public schema is pure (control plane only)');
        }

        console.log('\n=== FINAL RESULT ===');
        if (allPassed && results.length === 3) {
            console.log('🏆 PASS - Multi-tenant isolation and schema integrity confirmed\n');
            process.exit(0);
        } else {
            console.log('❌ FAIL - Onboarding flow is imperfect\n');
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ Verification failed:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

// Ensure server is up
setTimeout(runOnboardingTest, 5000);
