const axios = require('axios');

async function testOnboarding() {
  try {
    console.log('Testing onboarding API...');
    const result = await axios.post('http://localhost:8001/api/onboarding/business', {
      businessName: "Abhi Cafe Reset",
      businessEmail: "cafe@abhi.com",
      businessPhone: "+919876543210",
      businessAddress: "123 Reset Street, City",
      gstNumber: "22AAAAA0000A1Z5",
      adminName: "Abhilash Patel",
      adminEmail: "abhilashpatel112@gmail.com",
      adminPassword: "Password@123",
      cafeType: "SOLO"
    });
    console.log('✅ Onboarding SUCCESS:', JSON.stringify(result.data, null, 2));

    console.log('\nTesting Login API...');
    const loginResult = await axios.post('http://localhost:8001/api/tenant/login', {
      email: "abhilashpatel112@gmail.com",
      password: "Password@123"
    });
    console.log('✅ Login SUCCESS:', JSON.stringify(loginResult.data, null, 2));
    process.exit(0);
  } catch (error) {
    if (error.response) {
      console.error('❌ API Error:', error.response.status, JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('❌ Error:', error.message);
    }
    process.exit(1);
  }
}

testOnboarding();
