#!/usr/bin/env node
/**
 * Quick auth service test
 */

const { sequelize } = require('../config/unified_database');
const authService = require('../services/authService');

async function test() {
  try {
    await sequelize.authenticate();
    console.log('✅ DB connected');
    
    // Get first user
    const users = await sequelize.query('SELECT email FROM public.users LIMIT 1', { type: sequelize.QueryTypes.SELECT });
    if (users.length === 0) {
      console.log('❌ No users found');
      return;
    }
    
    console.log('Testing login with:', users[0].email);
    
    // Test with wrong password - should get "Invalid" error, not column error
    try {
      await authService.login(users[0].email, 'wrongpassword');
      console.log('❌ Should have thrown error');
    } catch (e) {
      if (e.message.includes('Invalid')) {
        console.log('✅ Auth service working! Got expected error:', e.message);
      } else {
        console.log('❌ Unexpected error:', e.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Failed:', error.message);
  } finally {
    await sequelize.close();
  }
}

test();
