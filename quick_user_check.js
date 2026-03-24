console.log('=== QUICK USER CHECK ===');

async function quickCheck() {
    try {
        require('dotenv').config();
        
        const { sequelize: sharedSequelize } = require('./config/database_postgres');
        
        // Get the most recent user
        const [users] = await sharedSequelize.query(`
            SELECT email, name, role, created_at 
            FROM users 
            ORDER BY created_at DESC 
            LIMIT 5
        `);
        
        console.log('\n📋 Most Recent Users:');
        if (users.rows.length === 0) {
            console.log('❌ No users found. You need to run onboarding first.');
            console.log('\n🚀 Run this command first:');
            console.log('curl -X POST http://localhost:8000/api/onboarding/business \\');
            console.log('  -H "Content-Type: application/json" \\');
            console.log('  -d "{');
            console.log('    \"businessName\": \"Test Cafe\",');
            console.log('    \"businessEmail\": \"test@cafe.com\",');
            console.log('    \"businessPhone\": \"+1234567890\",');
            console.log('    \"businessAddress\": \"123 Test Street\",');
            console.log('    \"gstNumber\": \"123456789012345\",');
            console.log('    \"adminName\": \"Test Admin\",');
            console.log('    \"adminEmail\": \"admin@cafe.com\",');
            console.log('    \"adminPassword\": \"Password123!\"');
            console.log('  }"');
        } else {
            users.rows.forEach((user, index) => {
                console.log(`${index + 1}. Email: ${user.email}`);
                console.log(`   Password: Password123!`);
                console.log('');
            });
            
            console.log('✅ Use any of these emails with password "Password123!" for login');
        }
        
    } catch (error) {
        console.error('❌ Check failed:', error.message);
    }
}

quickCheck();
