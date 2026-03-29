const { sequelize } = require('./config/unified_database');
const { ModelFactory } = require('./src/architecture/modelFactory');
const fs = require('fs');
const path = require('path');

async function generateRobustBaseline() {
    try {
        console.log('--- EXPORTING ALL MODEL DEFINITIONS ---');
        const models = await ModelFactory.createModels(sequelize);
        
        const tenantModels = require('./src/utils/constants').TENANT_MODELS;
        
        // REFINED SORTING PRIORITY (to handle FK dependencies)
        const priorityOrder = ['Outlet', 'Category', 'ProductType', 'InventoryCategory', 'Supplier', 'User', 'TenantRegistry', 'Business'];
        
        const sortedModels = [...tenantModels].sort((a, b) => {
            const indexA = priorityOrder.indexOf(a);
            const indexB = priorityOrder.indexOf(b);
            
            // If both in priority, use their order
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            
            // If only A in priority, it goes first
            if (indexA !== -1) return -1;
            
            // If only B in priority, it goes first
            if (indexB !== -1) return 1;
            
            // Otherwise maintain original order
            return 0;
        });

        let statements = [];

        for (const modelName of sortedModels) {
            const model = models[modelName];
            if (!model) {
                console.warn(`⚠️ Model ${modelName} not found`);
                continue;
            }

            const tableName = model.getTableName();
            const tableNameStr = typeof tableName === 'string' ? tableName : tableName.tableName;
            
            // Skip if it's schema_versions (handled by MigrationRunner)
            if (tableNameStr === 'schema_versions') continue;

            const attrs = model.rawAttributes;
            let colDefs = [];

            // Sort attributes to put 'id' first
            const attrKeys = Object.keys(attrs).sort((a, b) => {
                if (a === 'id') return -1;
                if (b === 'id') return 1;
                return 0;
            });

            const seenColumns = new Set();
            for (const attrName of attrKeys) {
                const attr = attrs[attrName];
                if (attr.type.key === 'VIRTUAL') continue;

                const colName = attr.field || attrName;
                if (seenColumns.has(colName)) continue;
                seenColumns.add(colName);

                let typeStr = '';
                const key = attr.type.key || '';
                const type = attr.type;
                
                if (key === 'UUID') typeStr = 'UUID';
                else if (key === 'STRING') typeStr = `VARCHAR(${type._length || 255})`;
                else if (key === 'TEXT') typeStr = 'TEXT';
                else if (key === 'INTEGER') typeStr = 'INTEGER';
                else if (key === 'BIGINT') typeStr = 'BIGINT';
                else if (key === 'DECIMAL') typeStr = `DECIMAL(${type._precision || 15}, ${type._scale || 2})`;
                else if (key === 'FLOAT' || key === 'DOUBLE' || key === 'REAL') typeStr = 'DOUBLE PRECISION';
                else if (key === 'BOOLEAN') typeStr = 'BOOLEAN';
                else if (key === 'DATE' || key === 'DATEONLY') typeStr = 'TIMESTAMP WITH TIME ZONE';
                else if (key === 'JSON' || key === 'JSONB') typeStr = 'JSONB';
                else typeStr = 'VARCHAR(255)';

                let def = `"${colName}" ${typeStr}`;
                if (attr.primaryKey) def += ' PRIMARY KEY';
                
                // Defaults
                const defaultValue = attr.defaultValue;
                if (defaultValue !== undefined) {
                    const defStr = String(defaultValue);
                    if (defStr.includes('UUIDV4') || defStr.includes('uuid_generate_v4') || (attr.primaryKey && key === 'UUID')) {
                        def += ' DEFAULT gen_random_uuid()';
                    } else if (defStr.includes('NOW') || defStr.includes('now')) {
                        def += ' DEFAULT NOW()';
                    } else if (typeof defaultValue !== 'function') {
                        if (typeof defaultValue === 'string') def += ` DEFAULT '${defaultValue}'`;
                        else if (typeof defaultValue === 'boolean') def += ` DEFAULT ${defaultValue}`;
                        else if (typeof defaultValue === 'object') def += ` DEFAULT '${JSON.stringify(defaultValue)}'`;
                        else def += ` DEFAULT ${defaultValue}`;
                    }
                } else if (colName === 'created_at' || colName === 'updated_at') {
                    def += ' DEFAULT NOW()';
                }
                
                if (attr.allowNull === false) def += ' NOT NULL';
                colDefs.push(def);
            }

            // ADD FOREIGN KEYS if they are critical and clear
            // For now, let's just make sure categories, products, and orders have them
            if (tableNameStr === 'products') {
                colDefs.push('CONSTRAINT fk_category FOREIGN KEY (category_id) REFERENCES "categories"(id) ON DELETE CASCADE');
                colDefs.push('CONSTRAINT fk_outlet FOREIGN KEY (outlet_id) REFERENCES "outlets"(id) ON DELETE CASCADE');
            } else if (tableNameStr === 'order_items') {
                colDefs.push('CONSTRAINT fk_order FOREIGN KEY (order_id) REFERENCES "orders"(id) ON DELETE CASCADE');
            } else if (tableNameStr === 'orders') {
                colDefs.push('CONSTRAINT fk_outlet FOREIGN KEY (outlet_id) REFERENCES "outlets"(id) ON DELETE CASCADE');
            } else if (tableNameStr === 'categories') {
                colDefs.push('CONSTRAINT fk_outlet FOREIGN KEY (outlet_id) REFERENCES "outlets"(id) ON DELETE CASCADE');
            }

            statements.push(`            \`CREATE TABLE IF NOT EXISTS "\${s}"."${tableNameStr}" (\n                ${colDefs.join(',\n                ')}\n            )\``);
        }

        const fileContent = `/**
 * MIGRATION v1: INITIAL BASELINE - FULL AUTO-GENERATED (V4 - HARDENED)
 * 
 * Generated on: ${new Date().toISOString()}
 * Tables: ${tenantModels.length}
 */

module.exports = {
    version: 1,
    description: 'Initial schema baseline - Full Auto-Generated V4',
    
    async up(sequelize, schemaName, tenantModels, transaction) {
        const s = schemaName;
        const options = { transaction };

        const statements = [
${statements.join(',\n\n')}
        ];

        console.log(\`[Migration]   -> Creating \${statements.length} tables in \${s}...\`);
        for (const sql of statements) {
            await sequelize.query(sql, options);
        }

        return true;
    }
};
`;

        fs.writeFileSync('migrations/tenant/v1_init.js', fileContent);
        console.log('✅ Successfully updated migrations/tenant/v1_init.js');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error generating baseline:', err);
        process.exit(1);
    }
}

generateRobustBaseline();
