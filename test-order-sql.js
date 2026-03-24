
const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

async function testOrderQuery() {
    const sequelize = new Sequelize('postgres://brewlabs_user:securepass@localhost:5432/brewlabs_dev', {
        logging: console.log,
        define: { underscored: true }
    });

    const Order = require('./models/orderModel')(sequelize);
    
    try {
        console.log('--- Testing Order.findAll() SQL Generation ---');
        await Order.findAll({
            where: { business_id: '25e6a57d-29ed-4f4a-9f50-c19e0d696037' },
            order: [['created_at', 'DESC']],
            limit: 1
        });
    } catch (error) {
        console.error('❌ Query failed:', error.message);
    } finally {
        await sequelize.close();
    }
}

testOrderQuery();
