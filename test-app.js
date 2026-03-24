// Test script to load app and capture errors
console.log('Testing app load...');
try {
  require('./app.js');
  console.log('App loaded successfully (or is starting)');
} catch (error) {
  console.error('Error loading app:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}
// Keep running for a few seconds
setTimeout(() => {
  console.log('Test complete - app stayed up for 5 seconds');
  process.exit(0);
}, 5000);
