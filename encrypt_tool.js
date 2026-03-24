require('dotenv').config();
const { encryptPassword } = require('./src/security/encryption');
try {
    const encrypted = encryptPassword('securepass');
    console.log('ENCRYPTED_PASSWORD=' + encrypted);
} catch (error) {
    console.error(error);
}
