console.log('=== DEBUG LOGIN FLOW ===');

async function debugLoginFlow() {
    try {
        require('dotenv').config();
        
        const bcrypt = require('bcryptjs');
        const { sequelize: sharedSequelize } = require('./config/database_postgres');
        const getUserModel = require('./models/userModel');
        
        console.log('\n🔍 STEP 1: Find a user to test');
        const User = getUserModel(sharedSequelize);
        const user = await User.findOne({
            order: [['createdAt', 'DESC']]
        });
        
        if (!user) {
            console.log('❌ No users found. Creating test user...');
            
            // Create a test user directly
            const testEmail = 'testuser@debug.com';
            const hashedPassword = await bcrypt.hash('Password123!', 10);
            
            await User.create({
                email: testEmail,
                name: 'Debug Test User',
                password: hashedPassword,
                role: 'ADMIN',
                panelType: 'TENANT',
                isActive: true,
                isVerified: true,
                businessId: '12345678-1234-1234-1234-123456789012'
            });
            
            console.log('✅ Test user created');
            console.log(`   Email: ${testEmail}`);
            console.log(`   Password: Password123!`);
            
            // Test login immediately
            console.log('\n🔍 STEP 2: Test login with created user');
            const authService = require('./services/auth.service');
            const loginResult = await authService.login(testEmail, 'Password123!');
            
            console.log('✅ Login successful!');
            console.log('📊 Login result:', {
                id: loginResult.id,
                email: loginResult.email,
                role: loginResult.role,
                panelType: loginResult.panelType
            });
            
            return;
        }
        
        console.log(`✅ Found user: ${user.email}`);
        console.log(`   Name: ${user.name}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Has Password: ${!!user.password}`);
        
        console.log('\n🔍 STEP 2: Test password comparison directly');
        const testPassword = 'Password123!';
        const isMatch = await bcrypt.compare(testPassword, user.password);
        console.log(`✅ Password match: ${isMatch}`);
        
        if (!isMatch) {
            console.log('❌ Password does not match!');
            console.log('   Trying other common passwords...');
            
            const passwords = ['password', 'admin', '123456', 'Password123'];
            for (const pwd of passwords) {
                const match = await bcrypt.compare(pwd, user.password);
                if (match) {
                    console.log(`✅ Found matching password: ${pwd}`);
                    break;
                }
            }
        }
        
        console.log('\n🔍 STEP 3: Test authService.login');
        try {
            const authService = require('./services/auth.service');
            const loginResult = await authService.login(user.email, testPassword);
            
            console.log('✅ AuthService login successful!');
            console.log('📊 Result:', {
                id: loginResult.id,
                email: loginResult.email,
                role: loginResult.role,
                panelType: loginResult.panelType
            });
            
        } catch (authError) {
            console.log('❌ AuthService login failed:', authError.message);
        }
        
        console.log('\n🔍 STEP 4: Test HTTP endpoint');
        console.log('Try this curl command:');
        console.log(`curl --location 'http://localhost:8000/api/auth/login' \\`);
        console.log(`--header 'Content-Type: application/json' \\`);
        console.log(`--data-raw '{`);
        console.log(`  "email": "${user.email}",`);
        console.log(`  "password": "${testPassword}"`);
        console.log(`}'`);
        
    } catch (error) {
        console.error('💥 Debug failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

debugLoginFlow();
