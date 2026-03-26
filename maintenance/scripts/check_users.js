console.log('=== CHECK USERS IN DATABASE ===');

async function checkUsers() {
    try {
        require('dotenv').config();
        
        // Check shared database for users
        const { sequelize: sharedSequelize } = require('../../config/database_postgres');
        
        const [users] = await sharedSequelize.query(`
            SELECT email, name, role, created_at 
            FROM users 
            ORDER BY created_at DESC 
            LIMIT 10
        `);
        
        console.log('\n📋 Recent Users in Shared Database:');
        if (users.rows.length === 0) {
            console.log('❌ No users found in shared database');
        } else {
            users.rows.forEach((user, index) => {
                console.log(`${index + 1}. Email: ${user.email}`);
                console.log(`   Name: ${user.name}`);
                console.log(`   Role: ${user.role}`);
                console.log(`   Created: ${user.created_at}`);
                console.log('');
            });
        }
        
        // Check if specific email exists
        const testEmail = 'fixedfk1698123456@cafe.com';
        const [specificUser] = await sharedSequelize.query(`
            SELECT email, name, role 
            FROM users 
            WHERE email = :email
        `, {
            replacements: { email: testEmail }
        });
        
        console.log(`\n🔍 Checking for email: ${testEmail}`);
        if (specificUser.rows.length === 0) {
            console.log('❌ User not found - this explains the "Invalid credentials" error');
        } else {
            console.log('✅ User found in database');
        }
        
    } catch (error) {
        console.error('❌ Database check failed:', error.message);
    }
}

checkUsers();
