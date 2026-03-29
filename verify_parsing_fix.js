
const { sequelize, connectUnifiedDB } = require('./config/unified_database');
const { ModelFactory } = require('./src/architecture/modelFactory');

async function verifyParsingFix() {
    try {
        await connectUnifiedDB();
        const models = await ModelFactory.createModels(sequelize);
        const { User, Outlet } = models;

        const email = 'aakash@admin.com';
        const user = await User.findOne({ where: { email } });

        if (!user) {
            console.log(`❌ User ${email} not found`);
            process.exit(1);
        }

        console.log('👤 USER DATA FROM DB:');
        console.log('  outletIds (raw):', user.outletIds, `(type: ${typeof user.outletIds})`);
        
        // --- SIMULATE FIXED CONTROLLER LOGIC ---
        let outlets = [];
        let outletIdsRaw = user.outletIds || user.outlet_ids || [];
        let outletIds = [];

        if (typeof outletIdsRaw === 'string') {
            try {
                outletIds = JSON.parse(outletIdsRaw);
                console.log('  -> Parsed from JSON string');
            } catch (e) {
                outletIds = outletIdsRaw.split(',').filter(id => id.trim()).map(id => id.trim());
                console.log('  -> Parsed from CSV string');
            }
        } else if (Array.isArray(outletIdsRaw)) {
            outletIds = outletIdsRaw;
            console.log('  -> Already an array');
        }

        if (outletIds.length === 0 && user.outletId) {
            outletIds = [user.outletId];
            console.log('  -> Fallback to single outletId');
        }

        console.log('  Processed outletIds:', outletIds);

        const businessId = user.businessId;
        const schemaName = `tenant_${businessId}`;

        if (outletIds.length > 0) {
            outlets = await Outlet.schema(schemaName).findAll({
                where: { id: outletIds }
            });
        }

        console.log(`✅ FOUND ${outlets.length} OUTLETS in ${schemaName}`);
        if (outlets.length > 0) {
            outlets.forEach(o => console.log(`  - ${o.name} (${o.id})`));
        } else {
            console.log('❌ NO OUTLETS FOUND! This would trigger the "No Access" message.');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

verifyParsingFix();
