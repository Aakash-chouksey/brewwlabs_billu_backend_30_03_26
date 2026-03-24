/**
 * Test Onboarding API
 */

const http = require('http');

const testData = {
  businessName: 'Test Cafe',
  businessEmail: 'test@example.com',
  businessPhone: '1234567890',
  businessAddress: '123 Test Street',
  gstNumber: '12ABCDE1234F1Z5',
  adminName: 'Test Admin',
  adminEmail: 'admin@example.com',
  adminPassword: 'Test@1234'
};

const options = {
  hostname: 'localhost',
  port: 8000,
  path: '/api/onboarding/business',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

console.log('Testing onboarding API...');
console.log('Request:', JSON.stringify(testData, null, 2));

const req = http.request(options, (res) => {
  let response = '';
  res.on('data', (chunk) => response += chunk);
  res.on('end', () => {
    console.log('\nResponse Status:', res.statusCode);
    console.log('Response Body:', response);
    try {
      const json = JSON.parse(response);
      console.log('\nParsed Response:', JSON.stringify(json, null, 2));
    } catch(e) {
      console.log('Raw response (not JSON)');
    }
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.write(JSON.stringify(testData));
req.end();
