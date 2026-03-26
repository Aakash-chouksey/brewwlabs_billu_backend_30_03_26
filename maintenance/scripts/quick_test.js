console.log('STARTING QUICK TEST...');
console.log('Node version:', process.version);
console.log('Current directory:', process.cwd());

try {
    require('dotenv').config();
    console.log('Environment loaded');
    console.log('NODE_ENV:', process.env.NODE_ENV);
} catch (e) {
    console.log('Environment loading failed:', e.message);
}

console.log('QUICK TEST COMPLETED');
