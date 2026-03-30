/**
 * Cloudinary Configuration Diagnostic Script
 * 
 * Run this to verify Cloudinary is properly configured:
 * node scripts/checkCloudinaryConfig.js
 */

require('dotenv').config();

console.log('\n🔍 Checking Cloudinary Configuration...\n');

const config = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET ? '***PRESENT***' : '***MISSING***'
};

console.log('Cloudinary Cloud Name:', config.cloud_name || '❌ NOT SET');
console.log('Cloudinary API Key:', config.api_key || '❌ NOT SET');
console.log('Cloudinary API Secret:', config.api_secret);

const allPresent = config.cloud_name && config.api_key && process.env.CLOUDINARY_API_SECRET;

console.log('\n' + (allPresent ? '✅ All Cloudinary variables are set' : '❌ Some Cloudinary variables are missing'));

if (allPresent) {
  console.log('\n🧪 Testing Cloudinary connection...');
  
  const { v2: cloudinary } = require('cloudinary');
  
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  
  // Test ping
  cloudinary.api.ping()
    .then(result => {
      console.log('✅ Cloudinary connection successful!');
      console.log('   Status:', result.status);
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Cloudinary connection failed:', error.message);
      process.exit(1);
    });
} else {
  console.log('\n📋 To fix this:');
  console.log('   1. Ensure .env.local has all Cloudinary variables');
  console.log('   2. RESTART the server (npm run dev or node app.js)');
  console.log('   3. Run this script again to verify');
  process.exit(1);
}
