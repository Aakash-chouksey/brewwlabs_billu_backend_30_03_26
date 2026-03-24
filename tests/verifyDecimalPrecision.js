const { roundTo } = require('../utils/mathUtils');
const assert = require('assert');

console.log('🧪 Starting Decimal Precision Verification...');

const testRounding = () => {
    console.log('\n--- Testing Rounding Utility ---');
    
    const cases = [
        { input: 0.1 + 0.2, expected: 0.3, label: '0.1 + 0.2 (Float Error)' },
        { input: 1.005, expected: 1.01, label: '1.005 (Rounding up)' },
        { input: 1.004, expected: 1.0, label: '1.004 (Rounding down)' },
        { input: "10.05", expected: 10.05, label: 'String "10.05"' },
        { input: 123.456, expected: 123.46, label: '123.456' },
        { input: 123.454, expected: 123.45, label: '123.454' }
    ];

    cases.forEach(({ input, expected, label }) => {
        const result = roundTo(input);
        console.log(`${label}: input=${input} -> result=${result}`);
        assert.strictEqual(result, expected, `Failed: ${label}`);
    });
    console.log('✅ Rounding utility tests passed!');
};

const testLogic = () => {
    console.log('\n--- Testing Calculation Logic Scenarios ---');
    
    // Scenario: Items with decimal prices
    const items = [
        { price: 10.12, quantity: 3 }, // 30.36
        { price: 5.55, quantity: 2 },  // 11.10
    ];
    
    const subtotal = roundTo(items.reduce((sum, i) => sum + (i.price * i.quantity), 0));
    console.log(`Subtotal: ${subtotal}`);
    assert.strictEqual(subtotal, 41.46);

    const taxRate = 5;
    const tax = roundTo((subtotal * taxRate) / 100);
    console.log(`Tax (5%): ${tax}`);
    assert.strictEqual(tax, 2.07); // 41.46 * 0.05 = 2.073 -> 2.07

    const discount = 5.51;
    const total = roundTo(subtotal + tax - discount);
    console.log(`Grand Total: ${total}`);
    assert.strictEqual(total, 38.02); // 41.46 + 2.07 - 5.51 = 38.02

    console.log('✅ Calculation logic tests passed!');
};

try {
    testRounding();
    testLogic();
    console.log('\n🎉 ALL DECIMAL PRECISION VERIFICATIONS PASSED!');
} catch (error) {
    console.error('\n❌ VERIFICATION FAILED:');
    console.error(error);
    process.exit(1);
}
