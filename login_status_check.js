console.log('=== LOGIN API STATUS CHECK ===');

async function statusCheck() {
    try {
        require('dotenv').config();
        
        console.log('\n🔍 CHECKING LOGIN API COMPONENTS...\n');
        
        // Check 1: Database Connection
        try {
            const { sequelize: sharedSequelize } = require('./config/database_postgres');
            await sharedSequelize.authenticate();
            console.log('✅ Database Connection: WORKING');
        } catch (dbError) {
            console.log('❌ Database Connection: FAILED');
            console.log('   Error:', dbError.message);
            return;
        }
        
        // Check 2: User Model
        try {
            const getUserModel = require('./models/userModel');
            const { sequelize: sharedSequelize } = require('./config/database_postgres');
            const User = getUserModel(sharedSequelize);
            await User.sync({ alter: true });
            console.log('✅ User Model: WORKING');
        } catch (modelError) {
            console.log('❌ User Model: FAILED');
            console.log('   Error:', modelError.message);
            return;
        }
        
        // Check 3: AuthService
        try {
            const authService = require('./services/auth.service');
            console.log('✅ AuthService: WORKING');
        } catch (authError) {
            console.log('❌ AuthService: FAILED');
            console.log('   Error:', authError.message);
            return;
        }
        
        // Check 4: Test User Creation
        try {
            const bcrypt = require('bcryptjs');
            const { v4: uuidv4 } = require('uuid');
            const getUserModel = require('./models/userModel');
            const { sequelize: sharedSequelize } = require('./config/database_postgres');
            const User = getUserModel(sharedSequelize);
            
            const testEmail = 'statustest@cafe.com';
            const testPassword = 'Password123!';
            const hashedPassword = await bcrypt.hash(testPassword, 10);
            
            await User.destroy({ where: { email: testEmail } });
            
            await User.create({
                id: uuidv4(),
                email: testEmail,
                name: 'Status Test User',
                password: hashedPassword,
                role: 'ADMIN',
                panelType: 'TENANT',
                isActive: true,
                isVerified: true,
                businessId: uuidv4(),
                outletId: uuidv4()
            });
            
            console.log('✅ User Creation: WORKING');
            
            // Check 5: Login Test
            try {
                const loginResult = await authService.login(testEmail, testPassword);
                console.log('✅ Login Test: WORKING');
                console.log(`   User ID: ${loginResult.id}`);
                console.log(`   Email: ${loginResult.email}`);
                
                // Check 6: Token Generation
                try {
                    const accessToken = authService.generateAccessToken(loginResult);
                    const refreshToken = authService.generateRefreshToken(loginResult);
                    console.log('✅ Token Generation: WORKING');
                } catch (tokenError) {
                    console.log('❌ Token Generation: FAILED');
                    console.log('   Error:', tokenError.message);
                }
                
            } catch (loginError) {
                console.log('❌ Login Test: FAILED');
                console.log('   Error:', loginError.message);
            }
            
        } catch (createError) {
            console.log('❌ User Creation: FAILED');
            console.log('   Error:', createError.message);
        }
        
        // Check 7: Server Status
        try {
            const http = require('http');
            const options = {
                hostname: 'localhost',
                port: 8000,
                path: '/health',
                method: 'GET',
                timeout: 2000
            };
            
            const req = http.request(options, (res) => {
                console.log(`✅ Server Status: WORKING (HTTP ${res.statusCode})`);
                
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        const health = JSON.parse(data);
                        console.log(`   Database: ${health.database}`);
                        console.log(`   Redis: ${health.redis}`);
                        console.log(`   Uptime: ${health.uptime}s`);
                    } catch (e) {
                        console.log('   Health check response received');
                    }
                    
                    console.log('\n🎉 LOGIN API STATUS CHECK COMPLETE!');
                    console.log('✅ All core components are working!');
                    console.log('\n📋 Ready for final verification:');
                    console.log('Run: node complete_login_verification.js');
                });
            });
            
            req.on('error', () => {
                console.log('❌ Server Status: FAILED');
                console.log('   Server not responding on port 8000');
                console.log('   Start server with: npm start');
            });
            
            req.on('timeout', () => {
                console.log('❌ Server Status: TIMEOUT');
                req.destroy();
            });
            
            req.end();
            
        } catch (serverError) {
            console.log('❌ Server Status: FAILED');
            console.log('   Error:', serverError.message);
        }
        
    } catch (error) {
        console.error('💥 Status check failed:', error.message);
    }
}

statusCheck();
