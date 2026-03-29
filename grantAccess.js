/**
 * GRANT SUBSCRIPTION ACCESS SCRIPT
 * Run this to give billucafe10@cafe.com full software access
 * 
 * Usage: node grantAccess.js
 */

const { sequelize } = require('./config/unified_database');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

async function grantAccess() {
    const email = 'billucafe10@cafe.com';
    const password = 'password123';
    
    console.log(`🔐 Granting access to ${email}...`);
    
    try {
        // Find the user
        const [userResult] = await sequelize.query(
            `SELECT id, business_id, name FROM "public"."users" WHERE email = :email`,
            { replacements: { email } }
        );
        
        if (userResult.length === 0) {
            console.error(`❌ User ${email} not found`);
            process.exit(1);
        }
        
        const user = userResult[0];
        const businessId = user.business_id;
        const userId = user.id;
        
        console.log(`✅ Found user: ${user.name} (${userId})`);
        console.log(`🏢 Business ID: ${businessId}`);
        
        // Update password to ensure it's correct
        const hashedPassword = await bcrypt.hash(password, 10);
        await sequelize.query(
            `UPDATE "public"."users" SET password_hash = :password, is_active = true, is_verified = true WHERE id = :id`,
            { replacements: { id: userId, password: hashedPassword } }
        );
        console.log(`🔑 Password updated to: ${password}`);
        
        // Find or create a plan
        const [planResult] = await sequelize.query(
            `SELECT id FROM "public"."plans" WHERE is_active = true LIMIT 1`
        );
        
        let planId;
        if (planResult.length === 0) {
            // Create a default plan
            planId = uuidv4();
            await sequelize.query(
                `INSERT INTO "public"."plans" (id, name, slug, price, billing_cycle, is_active, is_public, trial_days)
                 VALUES (:id, 'Business Plan', 'business', 0.00, 'monthly', true, true, 30)`,
                { replacements: { id: planId } }
            );
            console.log(`✅ Created default plan: ${planId}`);
        } else {
            planId = planResult[0].id;
            console.log(`✅ Using existing plan: ${planId}`);
        }
        
        // Check if subscription exists
        const [subResult] = await sequelize.query(
            `SELECT id FROM "public"."subscriptions" WHERE business_id = :businessId`,
            { replacements: { businessId } }
        );
        
        const now = new Date();
        const endDate = new Date();
        endDate.setFullYear(endDate.getFullYear() + 1); // 1 year access
        
        if (subResult.length === 0) {
            // Create new subscription
            const subId = uuidv4();
            await sequelize.query(
                `INSERT INTO "public"."subscriptions" (id, business_id, plan_id, status, billing_cycle, current_period_start, current_period_end)
                 VALUES (:id, :businessId, :planId, 'active', 'monthly', :start, :end)`,
                { 
                    replacements: { 
                        id: subId, 
                        businessId, 
                        planId, 
                        start: now, 
                        end: endDate 
                    } 
                }
            );
            console.log(`✅ Created subscription: ${subId}`);
        } else {
            // Update existing subscription
            await sequelize.query(
                `UPDATE "public"."subscriptions" 
                 SET status = 'active', plan_id = :planId, current_period_start = :start, current_period_end = :end
                 WHERE business_id = :businessId`,
                { 
                    replacements: { 
                        businessId, 
                        planId, 
                        start: now, 
                        end: endDate 
                    } 
                }
            );
            console.log(`✅ Updated subscription for business: ${businessId}`);
        }
        
        // Update business status to active
        await sequelize.query(
            `UPDATE "public"."businesses" SET status = 'active', is_active = true WHERE id = :id`,
            { replacements: { id: businessId } }
        );
        console.log(`✅ Business status set to active`);
        
        // Update tenant registry status
        await sequelize.query(
            `UPDATE "public"."tenant_registry" SET status = 'ACTIVE', activated_at = NOW() WHERE business_id = :id`,
            { replacements: { id: businessId } }
        );
        console.log(`✅ Tenant registry status set to ACTIVE`);
        
        console.log(`\n🎉 SUCCESS! Access granted to ${email}`);
        console.log(`   Login: ${email}`);
        console.log(`   Password: ${password}`);
        console.log(`   Subscription: ACTIVE (expires ${endDate.toISOString().split('T')[0]})`);
        
    } catch (error) {
        console.error('❌ Error granting access:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

grantAccess();
