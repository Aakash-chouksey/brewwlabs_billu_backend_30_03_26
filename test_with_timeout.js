const http = require('http');

const testPayload = {
  email: 'test123@test.com',
  password: 'Test123!',
  firstName: 'John',
  lastName: 'Doe',
  businessName: 'Test Biz',
  businessType: 'Retail'
};

const postData = JSON.stringify(testPayload);

const options = {
  hostname: 'localhost',
  port: 8000,
  path: '/api/onboarding/business',
  method: 'POST',
  timeout: 15000,  // 15 second timeout
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': postData.length
  }
};

const req = http.request(options, (res) => {
  let data = '';
  const startTime = Date.now();
  
  console.log(`[${new Date().toISOString()}] Status: ${res.statusCode}`);
  console.log(`[${new Date().toISOString()}] Headers:`, res.headers);
  
  res.on('data', (chunk) => {
    data += chunk;
    console.log(`[${new Date().toISOString()}] Received chunk: ${chunk.length} bytes (total: ${data.length} bytes)`);
  });
  
  res.on('end', () => {
    const duration = Date.now() - startTime;
    console.log(`\n[${new Date().toISOString()}] Response Complete`);
    console.log(`Duration: ${duration}ms`);
    console.log(`Data Length: ${data.length} bytes`);
    console.log(`First 500 chars: ${data.substring(0, 500)}`);
    process.exit(0);
  });
});

req.on('timeout', () => {
  console.error(`[${new Date().toISOString()}] ❌ REQUEST TIMEOUT (15 seconds)`);
  req.destroy();
  process.exit(1);
});

req.on('error', (error) => {
  console.error(`[${new Date().toISOString()}] ❌ REQUEST ERROR:`, error.message);
  process.exit(1);
});

console.log(`[${new Date().toISOString()}] Sending onboarding request...`);
const startTime = Date.now();
req.write(postData);
req.end();

setTimeout(() => {
  console.error(`\n[${new Date().toISOString()}] ❌ PROCESS TIMEOUT (20 seconds) - no response received`);
  process.exit(1);
}, 20000);
