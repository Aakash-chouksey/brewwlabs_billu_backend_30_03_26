const admin = require('firebase-admin');

const path = require('path');
const fs = require('fs');

// Path to service account key
const serviceAccountPath = path.join(__dirname, 'service-account.json');

// Initialize Firebase Admin
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase Admin initialized with environment credentials');
  } else if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase Admin initialized with local service-account.json');
  } else {
    // Attempt default initialization, but explicitly provide projectId from config
    admin.initializeApp({
      projectId: 'brewwlabs-billing'
    });
    console.log('✅ Firebase Admin initialized with Project ID: brewwlabs-billing');
  }
} catch (error) {
  console.warn('❌ Firebase Admin initialization failed:', error.message);
  console.warn('   Please provide credentials via FIREBASE_SERVICE_ACCOUNT env or pos-backend/config/service-account.json');
}

module.exports = admin;
