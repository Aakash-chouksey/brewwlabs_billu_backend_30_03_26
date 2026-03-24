#!/usr/bin/env node

/**
 * CREATE TEST USER WITH KNOWN PASSWORD
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const path = require('path');
const { controlPlaneSequelize } = require(path.join(process.cwd(), 'config', 'control_plane_db'));
const getUserModel = require(path.join(process.cwd(), 'models', 'userModel'));
const { v4: uuidv4 } = require('uuid');

async function createTestUser() {
    console.log('👤 Creating test user...');
    
    try {
        // Get User model
        const User = getUserModel(controlPlaneSequelize);
        
        // Hash password
        const password = 'TestPassword123!';
        const hashedPassword = await bcrypt.hash(password, 10);
        
        console.log('🔐 Password hashed successfully');
        
        // Create test user
        const user = await User.create({
            name: 'Test User',
            email: 'test@example.com',
            password: hashedPassword,
            role: 'ADMIN',
            businessId: '33b520a1-c0b0-4fe4-91ae-4e9df867a943', // Use existing business ID
            brandId: uuidv4(), // Generate new brand ID
            isActive: true
        });
        
        console.log('✅ Test user created successfully:');
        console.log('  ID:', user.id);
        console.log('  Email:', user.email);
        console.log('  Role:', user.role);
        
        // Test login immediately
        console.log('🔍 Testing login with new user...');
        const foundUser = await User.findOne({ where: { email: 'test@example.com' } });
        const isValid = await bcrypt.compare(password, foundUser.password);
        console.log('✅ Password verification:', isValid);
        
    } catch (error) {
        console.error('❌ Test user creation failed:', error.message);
        console.error('❌ Full error:', error);
    } finally {
        await controlPlaneSequelize.close();
    }
}

createTestUser();
