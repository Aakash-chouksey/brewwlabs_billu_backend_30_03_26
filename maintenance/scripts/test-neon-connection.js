require('dotenv').config();
const { Sequelize } = require('sequelize');

const connectionString = process.env.DATABASE_URL;

console.log('Testing Neon database connection...');
console.log('Connection string:', connectionString.replace(/\/\/(.*):(.*)@/, '//***:***@'));

const sequelize = new Sequelize(connectionString, {
  dialect: 'postgres',
  logging: console.log,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  }
});

async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('\n✅ Successfully connected to Neon database!');
    
    // Test a simple query
    const [results] = await sequelize.query('SELECT current_database() as db, current_schema() as schema, version() as version');
    console.log('\nDatabase Info:', results[0]);
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Connection failed:', error.message);
    process.exit(1);
  }
}

testConnection();
