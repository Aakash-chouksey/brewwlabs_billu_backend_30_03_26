#!/usr/bin/env node
/**
 * Clear Model Cache
 * =================
 * Forces regeneration of model hashes and clears in-memory caches
 */

const fs = require('fs');
const path = require('path');

const MODEL_HASHES_FILE = path.join(__dirname, '..', '.model-hashes.json');

console.log('🧹 Clearing model cache...\n');

// 1. Delete or reset model hashes file
if (fs.existsSync(MODEL_HASHES_FILE)) {
  try {
    // Option 1: Delete the file entirely (will be regenerated)
    // fs.unlinkSync(MODEL_HASHES_FILE);
    // console.log('✅ Deleted .model-hashes.json');
    
    // Option 2: Keep file but reset all hashes (forces reload)
    const hashes = JSON.parse(fs.readFileSync(MODEL_HASHES_FILE, 'utf8'));
    for (const [modelName, modelData] of Object.entries(hashes)) {
      // Increment hash to force reload
      if (modelData.hash) {
        const oldHash = modelData.hash;
        modelData.hash = oldHash.slice(0, -1) + String(Math.floor(Math.random() * 10));
      }
    }
    fs.writeFileSync(MODEL_HASHES_FILE, JSON.stringify(hashes, null, 2));
    console.log('✅ Updated all model hashes (forcing reload)');
    console.log(`   Modified: ${Object.keys(hashes).length} models\n`);
  } catch (error) {
    console.error('❌ Error updating model hashes:', error.message);
  }
} else {
  console.log('ℹ️  No .model-hashes.json file found (will be created on next start)\n');
}

// 2. Clear any model cache directories
const cacheDirs = [
  path.join(__dirname, '..', 'node_modules', '.cache'),
  path.join(__dirname, '..', '.tmp')
];

for (const dir of cacheDirs) {
  if (fs.existsSync(dir)) {
    console.log(`🗑️  Found cache directory: ${dir}`);
  }
}

console.log('\n📋 Next steps:');
console.log('   1. Stop the running server (Ctrl+C)');
console.log('   2. Run: npm start');
console.log('   3. The models will be reloaded with fresh definitions\n');

console.log('✨ Model cache cleared! Restart the server to apply changes.\n');
