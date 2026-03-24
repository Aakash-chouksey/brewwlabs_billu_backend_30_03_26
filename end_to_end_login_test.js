console.log('=== END-TO-END LOGIN TEST ===');

async function endToEndTest() {
    try {
        require('dotenv').config();
        
        // Step 1: Create a fresh business and user via onboarding
        console.log('\n🚀 STEP 1: Creating fresh business via onboarding...');
        
        const onboardingService = require('./services/onboarding.service');
        const timestamp = Date.now();
        
        const onboardingData = {
            businessName: `Login Test Cafe ${timestamp}`,
            businessEmail: `loginbusinesstest${timestamp}@cafe.com`,
            businessPhone: '+1234567890',
            businessAddress: '123 Test Street',
            gstNumber: '123456789012345',
            adminName: 'Login Test Admin',
            adminEmail: `loginadmintest${timestamp}@cafe.com`,
            adminPassword: 'Password123!',
            cafeType: 'SOLO'
        };
        
        console.log('Creating business:', onboardingData.businessName);
        console.log('Admin email:', onboardingData.adminEmail);
        
        const onboardingResult = await onboardingService.onboardBusiness(onboardingData);
        
        console.log('✅ Onboarding successful!');
        console.log('Business ID:', onboardingResult.businessId);
        console.log('Admin User ID:', onboardingResult.adminUserId);
        
        // Step 2: Test login with authService
        console.log('\n🔑 STEP 2: Testing authService.login...');
        
        const authService = require('./services/auth.service');
        
        try {
            const loginResult = await authService.login(
                onboardingData.adminEmail, 
                onboardingData.adminPassword
            );
            
            console.log('✅ AuthService login successful!');
            console.log('User ID:', loginResult.id);
            console.log('Email:', loginResult.email);
            console.log('Role:', loginResult.role);
            console.log('Panel Type:', loginResult.panelType);
            
            // Step 3: Test token generation
            console.log('\n🎫 STEP 3: Testing token generation...');
            
            const accessToken = authService.generateAccessToken(loginResult);
            const refreshToken = authService.generateRefreshToken(loginResult);
            
            console.log('✅ Tokens generated successfully');
            console.log('Access Token length:', accessToken.length);
            console.log('Refresh Token length:', refreshToken.length);
            
            // Step 4: Test HTTP endpoint
            console.log('\n🌐 STEP 4: Testing HTTP endpoint...');
            
            const testData = {
                email: onboardingData.adminEmail,
                password: onboardingData.adminPassword
            };
            
            // Create HTTP request
            const http = require('http');
            const postData = JSON.stringify(testData);
            
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
                        console.log('HTTP Response:', JSON.stringify(response, null, 2));
                        
                        if (response.success) {
                            console.log('\n🎉 LOGIN API VERIFICATION COMPLETE!');
                            console.log('✅ All tests passed successfully!');
                            console.log('✅ Login API is working properly!');
                            
                            console.log('\n📋 Test Results Summary:');
                            console.log('- Onboarding: ✅ Working');
                            console.log('- AuthService: ✅ Working');
                            console.log('- Token Generation: ✅ Working');
                            console.log('- HTTP Endpoint: ✅ Working');
                            
                            console.log('\n🚀 You can now use these credentials:');
                            console.log(`Email: ${onboardingData.adminEmail}`);
                            console.log(`Password: ${onboardingData.adminPassword}`);
                            
                        } else {
                            console.log('\n❌ HTTP endpoint failed:', response.message);
                        }
                    } catch (parseError) {
                        console.log('Raw HTTP response:', data);
                    }
                });
            });
            
            req.on('error', (e) => {
                console.error('HTTP request error:', e.message);
                console.log('\n⚠️ Server might not be running. Start server with: npm start');
            });
            
            req.write(postData);
            req.end();
            
        } catch (authError) {
            console.error('❌ AuthService login failed:', authError.message);
            console.error('Stack:', authError.stack);
        }
        
    } catch (error) {
        console.error('💥 End-to-end test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

endToEndTest();
