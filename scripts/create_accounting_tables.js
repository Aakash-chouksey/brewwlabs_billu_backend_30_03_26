/**
 * Create Accounting Tables Script
 * Creates accounts and transactions tables in tenant database
 */

require('dotenv').config();
const tenantConnectionFactory = require('../src/services/tenantConnectionFactory');

const createAccountingTables = async () => {
    try {
        console.log('🔗 Connecting to tenant database...');
        
        // Get tenant connection for the test brand
        const brandId = '5f1575c1-7b6f-44e4-a955-3fbf5c92fe20'; // Test brand ID
        const sequelize = await tenantConnectionFactory.getConnection(brandId);
        
        if (!sequelize) {
            throw new Error('Failed to get tenant connection');
        }
        
        console.log('✅ Connected to tenant database');
        
        // Create accounts table
        console.log('📊 Creating accounts table...');
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS accounts (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255) NOT NULL,
                type VARCHAR(50) DEFAULT 'Cash' CHECK (type IN ('Cash', 'Bank', 'Digital', 'Other')),
                balance DECIMAL(10,2) DEFAULT 0.00,
                business_id UUID NOT NULL,
                outlet_id UUID NOT NULL,
                status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);
        
        // Create transactions table
        console.log('💰 Creating transactions table...');
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                type VARCHAR(20) NOT NULL CHECK (type IN ('credit', 'debit')),
                category VARCHAR(255) NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                description TEXT,
                account_id UUID NOT NULL,
                date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                business_id UUID NOT NULL,
                outlet_id UUID NOT NULL,
                performed_by UUID,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
            );
        `);
        
        // Create indexes for better performance
        console.log('🔍 Creating indexes...');
        await sequelize.query(`
            CREATE INDEX IF NOT EXISTS idx_accounts_business_outlet ON accounts(business_id, outlet_id);
            CREATE INDEX IF NOT EXISTS idx_transactions_business_outlet ON transactions(business_id, outlet_id);
            CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
            CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
        `);
        
        // Insert sample data for testing
        console.log('📝 Inserting sample data...');
        await sequelize.query(`
            INSERT INTO accounts (id, name, type, balance, business_id, outlet_id) 
            VALUES 
                ('550e8400-e29b-41d4-a716-446655440000', 'Cash Account', 'Cash', 1000.00, :brandId, :outletId),
                ('550e8400-e29b-41d4-a716-446655440001', 'Bank Account', 'Bank', 5000.00, :brandId, :outletId)
            ON CONFLICT (id) DO NOTHING;
        `, {
            replacements: { 
                brandId,
                outletId: 'e4076db9-3afb-4b41-85c9-daf507b78d51' // Test outlet ID
            }
        });
        
        await sequelize.query(`
            INSERT INTO transactions (id, type, category, amount, description, account_id, business_id, outlet_id)
            VALUES
                ('660e8400-e29b-41d4-a716-446655440000', 'credit', 'Sales', 500.00, 'Daily sales', '550e8400-e29b-41d4-a716-446655440000', :brandId, :outletId),
                ('660e8400-e29b-41d4-a716-446655440001', 'debit', 'Expenses', 200.00, 'Office supplies', '550e8400-e29b-41d4-a716-446655440000', :brandId, :outletId)
            ON CONFLICT (id) DO NOTHING;
        `, {
            replacements: { 
                brandId,
                outletId: 'e4076db9-3afb-4b41-85c9-daf507b78d51'
            }
        });
        
        console.log('✅ Accounting tables created successfully!');
        console.log('📊 Sample data inserted for testing');
        
        // Verify tables exist
        const [accountsResult] = await sequelize.query('SELECT COUNT(*) as count FROM accounts');
        const [transactionsResult] = await sequelize.query('SELECT COUNT(*) as count FROM transactions');
        
        console.log(`📈 Accounts: ${accountsResult[0].count} records`);
        console.log(`💸 Transactions: ${transactionsResult[0].count} records`);
        
        await sequelize.close();
        
    } catch (error) {
        console.error('❌ Error creating accounting tables:', error);
        process.exit(1);
    }
};

if (require.main === module) {
    createAccountingTables().then(() => {
        console.log('🎉 Accounting table creation completed!');
        process.exit(0);
    }).catch(error => {
        console.error('💥 Failed to create accounting tables:', error);
        process.exit(1);
    });
}

module.exports = { createAccountingTables };
