/**
 * STEP 7: LOGIN FLOW TEST
 * 
 * Validates the authentication flow:
 * - User exists in public schema
 * - Password verification works
 * - tenant_registry status is active
 */

const colors = require('colors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../../config/config');

class LoginFlowTest {
    static async execute(sequelize, credentials) {
        console.log(colors.cyan(`  → Testing login flow for: ${credentials.email}...`));
        
        const results = {
            success: true,
            token: null,
            userId: null,
            businessId: null,
            issues: []
        };

        try {
            const { User, TenantRegistry } = sequelize.models;

            // 1. Find User
            const user = await User.schema('public').findOne({
                where: { email: credentials.email }
            });

            if (!user) {
                results.success = false;
                results.issues.push({
                    severity: 'CRITICAL',
                    message: `Login failed: user '${credentials.email}' not found in public.users`
                });
                return results;
            }

            // 2. Verify Password
            const valid = await bcrypt.compare(credentials.password, user.password);
            if (!valid) {
                results.success = false;
                results.issues.push({
                    severity: 'CRITICAL',
                    message: `Login failed: invalid password for '${credentials.email}'`
                });
            }

            // 3. Check Tenant Status (Case Insensitive)
            const registry = await TenantRegistry.schema('public').findOne({
                where: { businessId: user.businessId }
            });

            const status = (registry?.status || '').toUpperCase();
            if (!registry || status !== 'ACTIVE') {
                results.success = false;
                results.issues.push({
                    severity: 'CRITICAL',
                    message: `Login blocked: tenant status is '${registry?.status || 'MISSING'}' (Expected: ACTIVE)`,
                    details: { businessId: user.businessId }
                });
            }

            if (results.success) {
                // 4. Generate REAL JWT for Step 8
                const tokenPayload = {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    business_id: user.businessId,
                    outlet_id: user.outlet_id || user.outletId,
                    tokenVersion: user.tokenVersion || 0,
                    panelType: 'TENANT'
                };

                results.token = jwt.sign(tokenPayload, config.accessTokenSecret, {
                    issuer: 'brewwlabs-pos',
                    audience: 'brewwlabs-pos-users',
                    expiresIn: '1h'
                });

                results.userId = user.id;
                results.businessId = user.businessId;
                
                console.log(colors.green('  ✓ Step 7: Login flow validation PASSED (Token generated)'));
            }

        } catch (error) {
            results.success = false;
            results.issues.push({
                severity: 'CRITICAL',
                message: `Login flow exception: ${error.message}`
            });
        }

        return results;
    }
}

module.exports = LoginFlowTest;
