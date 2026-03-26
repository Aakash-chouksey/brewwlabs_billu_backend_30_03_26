console.log('=== COMPREHENSIVE LOGIN VERIFICATION ===');

async function verifyLogin() {
    try {
        require('dotenv').config();
        
        const authService = require('../../services/auth.service');
        const { sequelize: sharedSequelize } = require('../../config/database_postgres');
        const getUserModel = require('../../control_plane_models/userModel');
        
        console.log('\n🔍 STEP 1: Check Database Connection');
        await sharedSequelize.authenticate();
        console.log('✅ Shared database connected');
        
        console.log('\n🔍 STEP 2: Check Users Table');
        const User = getUserModel(sharedSequelize);
        const userCount = await User.count();
        console.log(`✅ Users table exists with ${userCount} records`);
        
        console.log('\n🔍 STEP 3: List Recent Users');
        const users = await User.findAll({
            attributes: ['id', 'email', 'name', 'role', 'businessId', 'createdAt'],
            order: [['createdAt', 'DESC']],
            limit: 5
        });
        
        if (users.length === 0) {
            console.log('❌ No users found in shared database');
            console.log('\n🚀 SOLUTION: Run onboarding first:');
            console.log('curl -X POST http://localhost:8000/api/onboarding/business \\');
            console.log('  -H "Content-Type: application/json" \\');
            console.log('  -d "{');
            console.log('    \"businessName\": \"Verify Test Cafe\",');
            console.log('    \"businessEmail\": \"verify@cafe.com\",');
            console.log('    \"businessPhone\": \"+1234567890\",');
            console.log('    \"businessAddress\": \"123 Test Street\",');
            console.log('    \"gstNumber\": \"123456789012345\",');
            console.log('    \"adminName\": \"Verify Admin\",');
            console.log('    \"adminEmail\": \"verifyadmin@cafe.com\",');
            console.log('    \"adminPassword\": \"Password123!\"');
            console.log('  }"');
            return;
        }
        
        console.log('📋 Recent Users:');
        users.forEach((user, index) => {
            console.log(`${index + 1}. Email: ${user.email}`);
            console.log(`   Name: ${user.name}`);
            console.log(`   Role: ${user.role}`);
            console.log(`   Business ID: ${user.businessId}`);
            console.log(`   Created: ${user.createdAt}`);
            console.log('');
        });
        
        console.log('\n🔍 STEP 4: Test Login with Each User');
        for (const user of users) {
            try {
                console.log(`\n🔑 Testing login for: ${user.email}`);
                const loginResult = await authService.login(user.email, 'Password123!');
                console.log('✅ Login successful!');
                console.log(`   User ID: ${loginResult.id}`);
                console.log(`   Role: ${loginResult.role}`);
                console.log(`   Panel Type: ${loginResult.panelType}`);
                
                // Test token generation
                const accessToken = authService.generateAccessToken(loginResult);
                console.log('✅ Token generated successfully');
                
                break; // Stop after first successful login
                
            } catch (loginError) {
                console.log(`❌ Login failed: ${loginError.message}`);
                
                // Try with different common passwords
                const commonPasswords = ['password', 'admin', '123456', 'Password123!'];
                for (const pwd of commonPasswords) {
                    try {
                        await authService.login(user.email, pwd);
                        console.log(`✅ SUCCESS with password: ${pwd}`);
                        return;
                    } catch (pwdError) {
                        // Continue trying
                    }
                }
            }
        }
        
        console.log('\n🔍 STEP 5: Manual Login Test');
        console.log('Try this manual test:');
        const testUser = users[0];
        console.log(`curl --location 'http://localhost:8000/api/auth/login' \\`);
        console.log(`--header 'Content-Type: application/json' \\`);
        console.log(`--data-raw '{`);
        console.log(`  "email": "${testUser.email}",`);
        console.log(`  "password": "Password123!"`);
        console.log(`}'`);
        
    } catch (error) {
        console.error('💥 Verification failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

verifyLogin();
