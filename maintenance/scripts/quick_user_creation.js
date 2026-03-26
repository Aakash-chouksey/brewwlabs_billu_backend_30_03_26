console.log('=== QUICK USER CREATION ===');

async function quickUserCreation() {
    try {
        require('dotenv').config();
        
        console.log('🔧 Creating working user immediately...');
        
        const bcrypt = require('bcryptjs');
        const { v4: uuidv4 } = require('uuid');
        const { sequelize: sharedSequelize } = require('../../config/database_postgres');
        const getUserModel = require('../../control_plane_models/userModel');
        
        // Test database connection
        await sharedSequelize.authenticate();
        console.log('✅ Database connected');
        
        // Get User model
        const User = getUserModel(sharedSequelize);
        await User.sync({ alter: true });
        console.log('✅ User table synced');
        
        // Create user
        const testEmail = 'workinguser@cafe.com';
        const testPassword = 'Password123!';
        const hashedPassword = await bcrypt.hash(testPassword, 10);
        
        // Delete existing user if any
        await User.destroy({ where: { email: testEmail } });
        
        // Create new user
        const user = await User.create({
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
        console.log(`   Email: ${user.email}`);
        console.log(`   Name: ${user.name}`);
        console.log(`   ID: ${user.id}`);
        
        // Verify user exists
        const foundUser = await User.findOne({ where: { email: testEmail } });
        console.log(`✅ User verification: ${foundUser ? 'FOUND' : 'NOT FOUND'}`);
        
        // Test password
        const passwordMatch = await bcrypt.compare(testPassword, foundUser.password);
        console.log(`✅ Password verification: ${passwordMatch ? 'MATCHES' : 'NO MATCH'}`);
        
        console.log('\n🎉 USER IS READY FOR LOGIN!');
        console.log('📋 Credentials:');
        console.log(`   Email: ${testEmail}`);
        console.log(`   Password: ${testPassword}`);
        
        console.log('\n🌐 Test immediately with:');
        console.log(`curl --location 'http://localhost:8000/api/auth/login' \\`);
        console.log(`--header 'Content-Type: application/json' \\`);
        console.log(`--data-raw '{`);
        console.log(`  "email": "${testEmail}",`);
        console.log(`  "password": "${testPassword}"`);
        console.log(`}'`);
        
    } catch (error) {
        console.error('❌ Creation failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

quickUserCreation();
