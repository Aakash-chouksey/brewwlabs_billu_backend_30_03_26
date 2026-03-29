const { sequelize } = require('./config/unified_database');
const { ModelFactory } = require('./src/architecture/modelFactory');
const fs = require('fs');

async function generateBaseline() {
    try {
        console.log('--- EXPORTING MODEL DEFINITIONS ---');
        const models = await ModelFactory.createModels(sequelize);
        
        const tenantModels = require('./src/utils/constants').TENANT_MODELS;
        let sqlStatements = [];

        for (const modelName of tenantModels) {
            const model = models[modelName];
            if (!model) {
                console.warn(`Model ${modelName} not found`);
                continue;
            }

            const tableName = model.getTableName();
            const tableNameStr = typeof tableName === 'string' ? tableName : tableName.tableName;
            
            const attrs = model.rawAttributes;
            let colDefs = [];

            for (const [attrName, attr] of Object.entries(attrs)) {
                if (attr.type.key === 'VIRTUAL') continue;

                const colName = attr.field || attrName;
                let typeStr = '';
                
                // Simplified type mapping for postgres
                const key = attr.type.key || '';
                if (key === 'UUID') typeStr = 'UUID';
                else if (key === 'STRING') typeStr = `VARCHAR(${attr.type._length || 255})`;
                else if (key === 'TEXT') typeStr = 'TEXT';
                else if (key === 'INTEGER') typeStr = 'INTEGER';
                else if (key === 'DECIMAL') typeStr = `DECIMAL(${attr.type._precision || 15}, ${attr.type._scale || 2})`;
                else if (key === 'BOOLEAN') typeStr = 'BOOLEAN';
                else if (key === 'DATE') typeStr = 'TIMESTAMP WITH TIME ZONE';
                else if (key === 'JSONB') typeStr = 'JSONB';
                else typeStr = 'VARCHAR(255)';

                let def = `"${colName}" ${typeStr}`;
                if (attr.primaryKey) def += ' PRIMARY KEY';
                if (attr.defaultValue === 'UUIDV4' || (attr.defaultValue && attr.defaultValue.toString().includes('uuid_generate_v4'))) {
                    def += ' DEFAULT gen_random_uuid()';
                } else if (attr.defaultValue === 'NOW' || (attr.defaultValue && attr.defaultValue.toString().includes('now'))) {
                    def += ' DEFAULT NOW()';
                } else if (attr.defaultValue !== undefined && typeof attr.defaultValue !== 'function') {
                    if (typeof attr.defaultValue === 'string') def += ` DEFAULT '${attr.defaultValue}'`;
                    else def += ` DEFAULT ${attr.defaultValue}`;
                }
                
                if (attr.allowNull === false) def += ' NOT NULL';
                
                colDefs.push(def);
            }

            sqlStatements.push(`CREATE TABLE IF NOT EXISTS "\${s}"."${tableNameStr}" (\n    ${colDefs.join(',\n    ')}\n)`);
        }

        console.log('--- GENERATED SQL ---');
        // console.log(sqlStatements.join(';\n\n'));
        
        fs.writeFileSync('v1_baseline_generated.sql', sqlStatements.join(';\n\n'));
        console.log('Saved to v1_baseline_generated.sql');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

generateBaseline();
