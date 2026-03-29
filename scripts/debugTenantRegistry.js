#!/usr/bin/env node
/**
 * Focused debug test for tenantId error
 */

const { sequelize } = require('../config/unified_database');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const neonTransactionSafeExecutor = require('../services/neonTransactionSafeExecutor');

async function test() {
  try {
    await sequelize.authenticate();
    console.log('DB connected\n');
    
    const businessId = uuidv4();
    const tenantId = uuidv4();
    const adminId = uuidv4();
    const outletId = uuidv4();
    const schemaName = `tenant_${businessId}`;
    
    console.log('Testing executeInPublic with TenantRegistry.create...');
    
    try {
      await neonTransactionSafeExecutor.executeInPublic(async (context) => {
        const { transaction, transactionModels: models } = context;
        console.log('Models available:', Object.keys(models));
        
        const { Business, User, TenantRegistry } = models;
        
        // Create Business
        console.log('Creating Business...');
        const business = await Business.create({
          id: businessId,
          name: 'Test Business',
          email: `test-${Date.now()}@test.local`,
          phone: '9999999999',
          address: '123 Test St',
          type: 'SOLO',
          status: 'active',
          ownerId: adminId,
          isActive: true
        }, { transaction });
        console.log('✅ Business created:', business.id);
        
        // Create User
        console.log('Creating User...');
        const hashedPass = await bcrypt.hash('testpass123', 10);
        const user = await User.create({
          id: adminId,
          businessId: businessId,
          outletId: outletId,
          outletIds: [outletId],
          name: 'Test Admin',
          email: `admin-${Date.now()}@test.local`,
          password: hashedPass,
          role: 'BusinessAdmin',
          panelType: 'TENANT',
          isActive: true,
          isVerified: true,
          tokenVersion: 1
        }, { transaction });
        console.log('✅ User created:', user.id);
        
        // Create TenantRegistry - THIS IS WHERE THE ERROR HAPPENS
        console.log('Creating TenantRegistry...');
        console.log('  tenantId:', tenantId);
        console.log('  business_id:', business.id);
        console.log('  schema_name:', schemaName);
        
        await TenantRegistry.create({
          id: tenantId,
          business_id: business.id,
          schema_name: schemaName,
          status: 'CREATING'
        }, { transaction });
        
        console.log('✅ TenantRegistry created');
      });
      
      console.log('\n✅ SUCCESS: All operations completed');
      
      // Cleanup
      await sequelize.query(`DELETE FROM public.tenant_registry WHERE id = :id`, { replacements: { id: tenantId } });
      await sequelize.query(`DELETE FROM public.users WHERE id = :id`, { replacements: { id: adminId } });
      await sequelize.query(`DELETE FROM public.businesses WHERE id = :id`, { replacements: { id: businessId } });
      console.log('Cleanup complete');
      
    } catch (innerError) {
      console.error('\n❌ Inner Error:', innerError.message);
      console.error('Stack:', innerError.stack);
    }
    
  } catch (error) {
    console.error('❌ Outer Error:', error.message);
    console.error(error.stack);
  } finally {
    await sequelize.close();
  }
}

test();
