/**
 * 🔍 POS BACKEND: FULL DATABASE ↔ SEQUELIZE CONSISTENCY AUDIT & AUTO-FIX
 * 
 * Objective:
 * 1. Scan DB structure (public + tenant)
 * 2. Scan Sequelize models (models/ + control_plane_models/)
 * 3. Detect mismatches (naming, missing columns, associations)
 * 4. Auto-fix model files
 */

const { Sequelize, DataTypes } = require('sequelize');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

// Configuration
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URI;
const MODELS_DIR = path.join(__dirname, 'models');
const CP_MODELS_DIR = path.join(__dirname, 'control_plane_models');

if (!connectionString) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
}

// Colors
const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    cyan: "\x1b[36m",
};

async function getDbStructure(schemaName) {
    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });
    
    try {
        await client.connect();
        const res = await client.query(`
            SELECT table_name, column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = $1
            ORDER BY table_name, ordinal_position
        `, [schemaName]);
        
        const structure = {};
        res.rows.forEach(row => {
            if (!structure[row.table_name]) structure[row.table_name] = [];
            structure[row.table_name].push({
                name: row.column_name,
                type: row.data_type,
                nullable: row.is_nullable === 'YES'
            });
        });
        return structure;
    } finally {
        await client.end();
    }
}

async function getSequelizeModels() {
    const sequelize = new Sequelize(connectionString, {
        dialect: 'postgres',
        logging: false,
        define: { underscored: true },
        dialectOptions: { ssl: { rejectUnauthorized: false } }
    });

    // 1. Load Tenant Models
    const { ModelFactory } = require('../../src/architecture/modelFactory');
    const tenantModels = await ModelFactory.createModels(sequelize);
    
    // 2. Load Control Plane Models
    const cpModelsRaw = require('./control_plane_models/index');
    const cpModels = {};
    Object.keys(cpModelsRaw).forEach(key => {
        const model = cpModelsRaw[key];
        if (model && model.prototype instanceof Sequelize.Model) {
            cpModels[key] = model;
        }
    });

    const modelData = {};
    const processModels = (models, schemaType) => {
        for (const [name, model] of Object.entries(models)) {
            modelData[name] = {
                name,
                tableName: model.tableName,
                schemaType,
                attributes: model.rawAttributes,
                options: model.options,
                associations: Object.keys(model.associations).map(alias => ({
                    alias,
                    type: model.associations[alias].associationType,
                    target: model.associations[alias].target.name,
                    foreignKey: model.associations[alias].foreignKey
                }))
            };
        }
    };

    processModels(tenantModels, 'TENANT');
    processModels(cpModels, 'PUBLIC');

    // Override: User is currently in PUBLIC according to DB scan
    if (modelData['User']) modelData['User'].schemaType = 'PUBLIC';
    if (modelData['Business']) modelData['Business'].schemaType = 'PUBLIC';
    if (modelData['TenantRegistry']) modelData['TenantRegistry'].schemaType = 'PUBLIC';

    return modelData;
}

function detectMismatches(publicStructure, tenantStructure, modelData) {
    const reports = [];
    
    for (const [mName, mInfo] of Object.entries(modelData)) {
        const dbStructure = mInfo.schemaType === 'PUBLIC' ? publicStructure : tenantStructure;
        const tableName = mInfo.tableName;
        const dbCols = dbStructure[tableName];

        if (!dbCols) {
            reports.push({ type: 'MISSING_TABLE', model: mName, table: tableName, schemaType: mInfo.schemaType });
            continue;
        }

        const modelAttributes = mInfo.attributes;
        const dbColNames = dbCols.map(c => c.name);

        // 1. Missing in Model
        dbCols.forEach(dbCol => {
            const attr = Object.values(modelAttributes).find(a => a.field === dbCol.name || (a.fieldName === dbCol.name && !a.field));
            if (!attr) {
                reports.push({ 
                    type: 'MISSING_IN_MODEL', 
                    model: mName, 
                    table: tableName, 
                    column: dbCol.name,
                    schemaType: mInfo.schemaType
                });
            }
        });

        // 2. Extra in Model
        Object.keys(modelAttributes).forEach(attrName => {
            const attr = modelAttributes[attrName];
            const fieldName = attr.field || attr.fieldName;
            if (attr.type instanceof DataTypes.VIRTUAL) return;

            if (!dbColNames.includes(fieldName)) {
                reports.push({ 
                    type: 'EXTRA_IN_MODEL', 
                    model: mName, 
                    table: tableName, 
                    column: fieldName,
                    attribute: attrName,
                    schemaType: mInfo.schemaType
                });
            }
        });

        // 3. Strict Fix Rules Checks
        if (!mInfo.options?.underscored) {
            reports.push({
                type: 'STRICT_FIX_REQUIRED',
                model: mName,
                rule: 'underscored: true missing',
                schemaType: mInfo.schemaType
            });
        }

        Object.keys(modelAttributes).forEach(attrName => {
            const attr = modelAttributes[attrName];
            const isCamelCase = /[A-Z]/.test(attrName);
            
            if (isCamelCase && !attr.field) {
                reports.push({
                    type: 'STRICT_FIX_REQUIRED',
                    model: mName,
                    attribute: attrName,
                    rule: 'Explicit field mapping missing for camelCase attribute',
                    schemaType: mInfo.schemaType
                });
            }
            
            if ((attrName === 'createdAt' || attrName === 'updatedAt') && !attr.field) {
                reports.push({
                    type: 'STRICT_FIX_REQUIRED',
                    model: mName,
                    attribute: attrName,
                    rule: 'Explicit field mapping missing for timestamp',
                    schemaType: mInfo.schemaType
                });
            }
        });

        // 4. Association Validation
        mInfo.associations.forEach(assoc => {
            if (!assoc.alias) {
                reports.push({
                    type: 'ASSOCIATION_ISSUE',
                    model: mName,
                    rule: 'Association missing alias (as)',
                    target: assoc.target,
                    schemaType: mInfo.schemaType
                });
            }
            if (!assoc.foreignKey) {
                reports.push({
                    type: 'ASSOCIATION_ISSUE',
                    model: mName,
                    rule: 'Association missing explicit foreignKey',
                    target: assoc.target,
                    schemaType: mInfo.schemaType
                });
            }
        });
    }

    return reports;
}

async function runAudit() {
    console.log(`${colors.bright}🚀 Starting Audit...${colors.reset}`);
    
    const publicStructure = await getDbStructure('public');
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
    await client.connect();
    const tenantRes = await client.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%' LIMIT 1");
    await client.end();
    
    const tenantSchema = tenantRes.rows[0]?.schema_name;
    let tenantStructure = {};
    if (tenantSchema) {
        console.log(`🔍 Scanning tenant schema: ${tenantSchema}`);
        tenantStructure = await getDbStructure(tenantSchema);
    }

    const modelData = await getSequelizeModels();
    const mismatches = detectMismatches(publicStructure, tenantStructure, modelData);

    if (mismatches.length === 0) {
        console.log(`${colors.green}✅ No mismatches detected!${colors.reset}`);
    } else {
        console.log(`${colors.red}❌ Detected ${mismatches.length} mismatches:${colors.reset}`);
        mismatches.forEach(m => {
            if (m.type === 'STRICT_FIX_REQUIRED') details = `(Rule: ${m.rule}${m.attribute ? `, Attr: ${m.attribute}` : ''})`;
            if (m.type === 'ASSOCIATION_ISSUE') details = `(Rule: ${m.rule}, Target: ${m.target})`;
            if (m.type === 'CASE_MISMATCH') details = `(Attr: ${m.attribute}, Expected Field: ${m.expectedField})`;
            if (m.type === 'MISSING_IN_MODEL') details = `(Col: ${m.column})`;
            if (m.type === 'EXTRA_IN_MODEL') details = `(Col/Attr: ${m.column})`;
            if (m.type === 'MISSING_TABLE') details = `(Table: ${m.table}, Schema: ${m.schemaType})`;
            console.log(`  - [${m.type}] ${m.model || m.table}: ${details}`);
        });
    }

    return { mismatches, modelData };
}

async function autoFix() {
    const { mismatches } = await runAudit();
    if (mismatches.length === 0) return;

    console.log(`\n${colors.bright}🛠️ Applying Auto-Fixes...${colors.reset}`);
    
    for (const m of mismatches) {
        if (m.type === 'CASE_MISMATCH') {
            const mData = m;
            const fileName = `${mData.model.charAt(0).toLowerCase()}${mData.model.slice(1)}Model.js`;
            const filePath = mData.schemaType === 'PUBLIC' ? path.join(CP_MODELS_DIR, fileName) : path.join(MODELS_DIR, fileName);
            
            if (fs.existsSync(filePath)) {
                let content = fs.readFileSync(filePath, 'utf8');
                // Very basic injection logic for camelCase attributes
                const regex = new RegExp(`${mData.attribute}:\\s*{`, 'g');
                if (content.match(regex)) {
                    content = content.replace(regex, `${mData.attribute}: { field: '${mData.expectedField}',`);
                    fs.writeFileSync(filePath, content);
                    console.log(`✅ Fixed field mapping in ${fileName}: ${mData.attribute} -> ${mData.expectedField}`);
                }
            }
        }
    }
}

const action = process.argv[2] || 'audit';
if (action === 'audit') {
    runAudit().catch(e => { console.error(e); process.exit(1); });
} else if (action === 'fix') {
    autoFix().catch(e => { console.error(e); process.exit(1); });
}
