const { sequelize } = require('../config/database_postgres');

async function addAuthColumns() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connection has been established successfully.');

        const queryInterface = sequelize.getQueryInterface();

        // Check if columns exist before adding
        const tableDesc = await queryInterface.describeTable('Users');

        if (!tableDesc.googleId) {
            await queryInterface.addColumn('Users', 'googleId', {
                type: sequelize.Sequelize.STRING,
                allowNull: true
            });
            console.log('✅ Added googleId column');
        } else {
            console.log('ℹ️ googleId column already exists');
        }

        if (!tableDesc.isVerified) {
            await queryInterface.addColumn('Users', 'isVerified', {
                type: sequelize.Sequelize.BOOLEAN,
                defaultValue: false
            });
            console.log('✅ Added isVerified column');
        } else {
             console.log('ℹ️ isVerified column already exists');
        }

        if (!tableDesc.refreshToken) {
            await queryInterface.addColumn('Users', 'refreshToken', {
                type: sequelize.Sequelize.TEXT,
                allowNull: true
            });
            console.log('✅ Added refreshToken column');
        } else {
             console.log('ℹ️ refreshToken column already exists');
        }

    } catch (error) {
        console.error('❌ Error adding columns:', error);
    } finally {
        await sequelize.close();
    }
}

addAuthColumns();
