try {
    console.log('Loading tenant.routes.js...');
    require('./routes/tenant/tenant.routes.js');
    console.log('✅ Successfully loaded tenant.routes.js');
} catch (error) {
    console.error('❌ Failed to load tenant.routes.js:');
    console.error(error);
}
