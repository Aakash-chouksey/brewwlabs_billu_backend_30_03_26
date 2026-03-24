console.log('=== COMPLETE LOGIN API VERIFICATION ===');

async function completeVerification() {
    try {
        require('dotenv').config();
        
        // Step 1: Environment Check
        console.log('\n📋 STEP 1: Environment & Database');
        console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
        console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
        
        const { sequelize: sharedSequelize } = require('./config/database_postgres');
        await sharedSequelize.authenticate();
        console.log('✅ Shared database connected');
        
        // Step 2: Model & Table Setup
        console.log('\n📋 STEP 2: Model Setup');
        const getUserModel = require('./models/userModel');
        const User = getUserModel(sharedSequelize);
        await User.sync({ alter: true });
        console.log('✅ User model loaded and table synced');
        
        // Step 3: Create Test User
        console.log('\n📋 STEP 3: Create Test User');
        const bcrypt = require('bcryptjs');
        const { v4: uuidv4 } = require('uuid');
        
        const testEmail = 'testlogin@cafe.com';
        const testPassword = 'Password123!';
        const hashedPassword = await bcrypt.hash(testPassword, 10);
        
        // Clean up existing user
        await User.destroy({ where: { email: testEmail } });
        
        // Create new user
        const testUser = await User.create({
            id: uuidv4(),
            email: testEmail,
            name: 'Login Test User',
            password: hashedPassword,
            role: 'ADMIN',
            panelType: 'TENANT',
            isActive: true,
            isVerified: true,
            businessId: uuidv4(),
            outletId: uuidv4()
        });
        
        console.log('✅ Test user created');
        console.log(`   Email: ${testUser.email}`);
        console.log(`   ID: ${testUser.id}`);
        
        // Step 4: Verify User in Database
        console.log('\n📋 STEP 4: Verify User in Database');
        const foundUser = await User.findOne({ where: { email: testEmail } });
        console.log(`✅ User found: ${foundUser ? 'YES' : 'NO'}`);
        
        if (!foundUser) {
            throw new Error('User not found in database');
        }
        
        // Step 5: Test Password Verification
        console.log('\n📋 STEP 5: Password Verification');
        const isMatch = await bcrypt.compare(testPassword, foundUser.password);
        console.log(`✅ Password matches: ${isMatch}`);
        
        if (!isMatch) {
            throw new Error('Password verification failed');
        }
        
        // Step 6: Test AuthService
        console.log('\n📋 STEP 6: AuthService Login Test');
        const authService = require('./services/auth.service');
        
        try {
            const loginResult = await authService.login(testEmail, testPassword);
            console.log('✅ AuthService login successful');
            console.log(`   User ID: ${loginResult.id}`);
            console.log(`   Email: ${loginResult.email}`);
            console.log(`   Role: ${loginResult.role}`);
            
            // Step 7: Test Token Generation
            console.log('\n📋 STEP 7: Token Generation');
            const accessToken = authService.generateAccessToken(loginResult);
            const refreshToken = authService.generateRefreshToken(loginResult);
            console.log('✅ Tokens generated successfully');
            console.log(`   Access Token Length: ${accessToken.length}`);
            console.log(`   Refresh Token Length: ${refreshToken.length}`);
            
            // Step 8: Test HTTP Endpoint
            console.log('\n📋 STEP 8: HTTP Endpoint Test');
            
            const http = require('http');
            const postData = JSON.stringify({
                email: testEmail,
                password: testPassword
            });
            
            const options = {
                hostname: 'localhost',
                port: 8000,
                path: '/api/auth/login',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };
            
            const req = http.request(options, (res) => {
                console.log(`HTTP Status: ${res.statusCode}`);
                
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        console.log('✅ HTTP Response received');
                        console.log('Response:', JSON.stringify(response, null, 2));
                        
                        if (response.success) {
                            console.log('\n🎉 LOGIN API VERIFICATION COMPLETE!');
                            console.log('✅ All components working correctly!');
                            
                            console.log('\n📊 Verification Results:');
                            console.log('- Database Connection: ✅');
                            console.log('- User Model: ✅');
                            console.log('- User Creation: ✅');
                            console.log('- Password Verification: ✅');
                            console.log('- AuthService: ✅');
                            console.log('- Token Generation: ✅');
                            console.log('- HTTP Endpoint: ✅');
                            console.log('- Response Format: ✅');
                            
                            console.log('\n🚀 LOGIN API IS WORKING PROPERLY!');
                            console.log('\n📋 Final Test Credentials:');
                            console.log(`   Email: ${testEmail}`);
                            console.log(`   Password: ${testPassword}`);
                            
                        } else {
                            console.log('\n❌ HTTP endpoint failed:', response.message);
                        }
                    } catch (parseError) {
                        console.log('Raw HTTP response:', data);
                    }
                });
            });
            
            req.on('error', (e) => {
                console.error('❌ HTTP request error:', e.message);
                console.log('⚠️ Make sure server is running: npm start');
            });
            
            req.write(postData);
            req.end();
            
        } catch (authError) {
            console.error('❌ AuthService login failed:', authError.message);
            throw authError;
        }
        
    } catch (error) {
        console.error('\n💥 VERIFICATION FAILED:', error.message);
        console.error('Stack:', error.stack);
    }
}

completeVerification();
