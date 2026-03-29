#!/usr/bin/env node
/**
 * Debug migration order
 */
const fs = require('fs');
const path = require('path');

const migrationsPath = path.join(__dirname, '../migrations/tenant');
const files = fs.readdirSync(migrationsPath)
    .filter(file => file.endsWith('.js') || file.endsWith('.sql'))
    .sort();

console.log('Migration files (sorted):');
for (const file of files) {
    const versionMatch = file.match(/^(v|0+)(\d+)/i);
    const version = versionMatch ? parseInt(versionMatch[2]) : 'INVALID';
    console.log(`  ${file} → version ${version}`);
}
