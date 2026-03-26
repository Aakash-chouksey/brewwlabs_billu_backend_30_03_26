console.log('=== CREATE AND VERIFY USER ===');

async function createAndVerifyUser() {
    try {
        require('dotenv').config();
        
        const bcrypt = require('bcryptjs');
        const { v4: uuidv4 } = require('uuid');
        const { sequelize: sharedSequelize } = require('../../config/database_postgres');
        const getUserModel = require('../../control_plane_models/userModel');
        
        // Step 1: Create a guaranteed working user
        console.log('\n🔧 STEP 1: Creating test user...');
        
        const testEmail = 'workinguser@cafe.com';
        const testPassword = 'Password123!';
        const hashedPassword = await bcrypt.hash(testPassword, 10);
        
        const User = getUserModel(sharedSequelize);
        
        // Clean up any existing user
        await User.destroy({ where: { email: testEmail } });
        
        // Create new user
        const testUser = await User.create({
            id: uuidv4(),
            email: testEmail,
            name: 'Working Test User',
            password: hashedPassword,
            role: 'ADMIN',
            panelType: 'TENANT',
            isActive: true,
            isVerified: true,
            businessId: uuidv4(),
            outletId: uuidv4()
        });
        
        console.log('✅ User created successfully!');
        console.log(`   Email: ${testUser.email}`);
        console.log(`   ID: ${testUser.id}`);
        console.log(`   Name: ${testUser.name}`);
        
        // Step 2: Verify user exists in database
        console.log('\n🔍 STEP 2: Verifying user exists...');
        
        const foundUser = await User.findOne({ where: { email: testEmail } });
        console.log(`✅ User found: ${foundUser ? 'YES' : 'NO'}`);
        
        if (foundUser) {
            console.log(`   Email: ${foundUser.email}`);
            console.log(`   Has Password: ${!!foundUser.password}`);
        }
        
        // Step 3: Test password verification
        console.log('\n🔍 STEP 3: Testing password verification...');
        
        const isMatch = await bcrypt.compare(testPassword, foundUser.password);
        console.log(`✅ Password matches: ${isMatch}`);
        
        // Step 4: Test authService login
        console.log('\n🔍 STEP 4: Testing authService.login...');
        
        const authService = require('../../services/auth.service');
        
        try {
            const loginResult = await authService.login(testEmail, testPassword);
            console.log('✅ AuthService login successful!');
            console.log(`   User ID: ${loginResult.id}`);
            console.log(`   Email: ${loginResult.email}`);
            console.log(`   Role: ${loginResult.role}`);
            console.log(`   Panel Type: ${loginResult.panelType}`);
            
            // Step 5: Generate tokens
            console.log('\n🎫 STEP 5: Generating tokens...');
            
            const accessToken = authService.generateAccessToken(loginResult);
            const refreshToken = authService.generateRefreshToken(loginResult);
            
            console.log('✅ Tokens generated successfully');
            
            console.log('\n🎉 SUCCESS! Login API is working!');
            console.log('\n📋 Use these credentials for testing:');
            console.log(`   Email: ${testEmail}`);
            console.log(`   Password: ${testPassword}`);
            
            console.log('\n🌐 Test with curl:');
            console.log(`curl --location 'http://localhost:8000/api/auth/login' \\`);
            console.log(`--header 'Content-Type: application/json' \\`);
            console.log(`--data-raw '{`);
            console.log(`  "email": "${testEmail}",`);
            console.log(`  "password": "${testPassword}"`);
            console.log(`}'`);
            
            console.log('\n📋 Test in Postman:');
            console.log('1. Import login_postman_request.json');
            console.log('2. Update email to: ' + testEmail);
            console.log('3. Send request');
            
        } catch (loginError) {
            console.error('❌ AuthService login failed:', loginError.message);
            console.error('Stack:', loginError.stack);
        }
        
    } catch (error) {
        console.error('💥 Process failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

createAndVerifyUser();
