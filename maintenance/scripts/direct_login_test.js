console.log('=== DIRECT LOGIN TEST ===');

async function directTest() {
    try {
        require('dotenv').config();
        
        const bcrypt = require('bcryptjs');
        const { sequelize: sharedSequelize } = require('../../config/database_postgres');
        const getUserModel = require('../../control_plane_models/userModel');
        
        // Create a test user with known credentials
        console.log('🔧 Creating test user with known credentials...');
        
        const testEmail = 'directtest@cafe.com';
        const testPassword = 'Password123!';
        const hashedPassword = await bcrypt.hash(testPassword, 10);
        
        const User = getUserModel(sharedSequelize);
        
        // Delete any existing test user
        await User.destroy({ where: { email: testEmail } });
        
        // Create new test user
        const testUser = await User.create({
            id: require('uuid').v4(),
            email: testEmail,
            name: 'Direct Test User',
            password: hashedPassword,
            role: 'ADMIN',
            panelType: 'TENANT',
            isActive: true,
            isVerified: true,
            businessId: '12345678-1234-1234-1234-123456789012',
            outletId: '12345678-1234-1234-1234-123456789abc'
        });
        
        console.log('✅ Test user created:', testUser.email);
        
        // Test direct bcrypt comparison
        console.log('\n🔍 Testing bcrypt comparison...');
        const isMatch = await bcrypt.compare(testPassword, hashedPassword);
        console.log(`✅ Direct bcrypt match: ${isMatch}`);
        
        // Test authService login
        console.log('\n🔍 Testing authService.login...');
        const authService = require('../../services/auth.service');
        
        try {
            const loginResult = await authService.login(testEmail, testPassword);
            console.log('✅ AuthService login successful!');
            console.log('📊 User data:', {
                id: loginResult.id,
                email: loginResult.email,
                role: loginResult.role,
                panelType: loginResult.panelType
            });
            
            // Test token generation
            const accessToken = authService.generateAccessToken(loginResult);
            console.log('✅ Access token generated');
            
            console.log('\n🚀 READY FOR HTTP TEST!');
            console.log('Use this exact curl command:');
            console.log(`curl --location 'http://localhost:8000/api/auth/login' \\`);
            console.log(`--header 'Content-Type: application/json' \\`);
            console.log(`--data-raw '{`);
            console.log(`  "email": "${testEmail}",`);
            console.log(`  "password": "${testPassword}"`);
            console.log(`}'`);
            
        } catch (loginError) {
            console.error('❌ AuthService login failed:', loginError.message);
            console.error('Stack:', loginError.stack);
        }
        
    } catch (error) {
        console.error('💥 Direct test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

directTest();
