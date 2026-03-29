#!/usr/bin/env node
/**
 * Debug tenantId error
 */

const { sequelize } = require('../config/unified_database');
const { v4: uuidv4 } = require('uuid');

async function test() {
  try {
    await sequelize.authenticate();
    console.log('DB connected');
    
    const businessId = uuidv4();
    const tenantId = uuidv4();
    const schemaName = `tenant_${businessId}`;
    
    console.log('Testing TenantRegistry.create...');
    
    // Test with raw SQL first
    await sequelize.query(
      `INSERT INTO public.tenant_registry (id, business_id, schema_name, status) 
       VALUES (:id, :businessId, :schemaName, 'CREATING')`,
      {
        replacements: { id: tenantId, businessId, schemaName },
        type: sequelize.QueryTypes.INSERT
      }
    );
    
    console.log('✅ Raw SQL insert worked');
    
    // Cleanup
    await sequelize.query(
      `DELETE FROM public.tenant_registry WHERE id = :id`,
      { replacements: { id: tenantId } }
    );
    console.log('Cleanup done');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await sequelize.close();
  }
}

test();
