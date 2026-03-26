const http = require('http');
const https = require('https');

function testLoginEndpoint() {
    const testData = {
        email: 'verificationtest@cafe.com',
        password: 'Password123!'
    };
    
    const postData = JSON.stringify(testData);
    
    const options = {
        hostname: 'localhost',
        port: 8000,
        path: '/api/auth/login',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };
    
    const req = http.request(options, (res) => {
        console.log(`Status: ${res.statusCode}`);
        console.log('Headers:', res.headers);
        
        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });
        
        res.on('end', () => {
            try {
                const response = JSON.parse(data);
                console.log('Response:', JSON.stringify(response, null, 2));
                
                if (response.success) {
                    console.log('✅ LOGIN API WORKING!');
                } else {
                    console.log('❌ Login failed:', response.message);
                }
            } catch (parseError) {
                console.log('Raw response:', data);
            }
        });
    });
    
    req.on('error', (e) => {
        console.error(`Request error: ${e.message}`);
    });
    
    req.write(postData);
    req.end();
}

console.log('Testing login endpoint...');
testLoginEndpoint();
