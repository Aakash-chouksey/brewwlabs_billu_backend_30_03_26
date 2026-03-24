#!/usr/bin/env node

/**
 * NEON-SAFETY VERIFICATION SCRIPT
 * 
 * This script performs strict verification that the codebase is 100% Neon-safe
 * Run after refactoring to ensure zero unsafe operations remain
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ========================================
// CONFIGURATION
// ========================================
const CONFIG = {
  backendPath: path.join(__dirname, '..'),
  allowedDirectories: ['controllers', 'services', 'routes', 'middlewares', 'config', 'src', 'utils'],
  excludePatterns: ['node_modules', '.git', 'test', 'spec', 'refactored', '.bak', '.old']
};

// ========================================
// UNSAFE PATTERNS TO DETECT
// ========================================
const UNSAFE_PATTERNS = [
  {
    name: 'Direct Model.findAll without transaction',
    pattern: /\.(findAll|findOne)\s*\([^)]*\)(?!.*transaction)/,
    severity: 'CRITICAL',
    message: 'Model query without transaction - CROSS-TENANT LEAKAGE RISK',
    excludeFiles: ['neonSafeDatabase.js', 'neonTransactionSafeExecutor.js']
  },
  {
    name: 'Direct Model.create without transaction',
    pattern: /\.(create|bulkCreate)\s*\([^)]*\)(?!.*transaction)/,
    severity: 'CRITICAL',
    message: 'Model create without transaction - CROSS-TENANT LEAKAGE RISK',
    excludeFiles: ['neonSafeDatabase.js', 'neonTransactionSafeExecutor.js']
  },
  {
    name: 'Direct Model.update without transaction',
    pattern: /\.(update|increment|decrement)\s*\([^)]*\)(?!.*transaction)/,
    severity: 'CRITICAL',
    message: 'Model update without transaction - CROSS-TENANT LEAKAGE RISK',
    excludeFiles: ['neonSafeDatabase.js', 'neonTransactionSafeExecutor.js']
  },
  {
    name: 'Direct Model.destroy without transaction',
    pattern: /\.(destroy|truncate)\s*\([^)]*\)(?!.*transaction)/,
    severity: 'CRITICAL',
    message: 'Model destroy without transaction - CROSS-TENANT LEAKAGE RISK',
    excludeFiles: ['neonSafeDatabase.js', 'neonTransactionSafeExecutor.js']
  },
  {
    name: 'Raw sequelize.query without transaction',
    pattern: /sequelize\.query\s*\([^)]*\)(?!.*\{[^}]*transaction[^}]*\})/,
    severity: 'CRITICAL',
    message: 'Raw query without transaction - CROSS-TENANT LEAKAGE RISK',
    excludeFiles: ['neonSafeDatabase.js', 'neonTransactionSafeExecutor.js']
  },
  {
    name: 'Global SET search_path',
    pattern: /sequelize\.query\s*\(\s*['"`]\s*SET\s+search_path/,
    severity: 'CRITICAL',
    message: 'Global schema switching - VIOLATES NEON SAFETY',
    excludeFiles: []
  },
  {
    name: 'Model.findAndCountAll without transaction',
    pattern: /\.findAndCountAll\s*\([^)]*\)(?!.*transaction)/,
    severity: 'CRITICAL',
    message: 'Model query without transaction - CROSS-TENANT LEAKAGE RISK',
    excludeFiles: ['neonSafeDatabase.js', 'neonTransactionSafeExecutor.js']
  },
  {
    name: 'Model.count without transaction',
    pattern: /\.count\s*\([^)]*\)(?!.*transaction)/,
    severity: 'CRITICAL',
    message: 'Model count without transaction - CROSS-TENANT LEAKAGE RISK',
    excludeFiles: ['neonSafeDatabase.js', 'neonTransactionSafeExecutor.js']
  }
];

// ========================================
// REQUIRED SAFE PATTERNS
// ========================================
const SAFE_PATTERNS = [
  {
    name: 'Global transaction enforcement hook',
    pattern: /addHook.*beforeQuery|beforeQuery.*transaction/,
    required: true,
    message: 'Global transaction enforcement hook is REQUIRED'
  },
  {
    name: 'executeWithTenant usage',
    pattern: /executeWithTenant|readWithTenant|writeWithTenant/,
    required: true,
    message: 'Transaction-safe execution methods must be used'
  },
  {
    name: 'Neon-safe middleware',
    pattern: /neonSafeTenantMiddleware/,
    required: true,
    message: 'Neon-safe middleware must be used'
  }
];

// ========================================
// VERIFICATION RESULTS
// ========================================
const results = {
  filesScanned: 0,
  unsafePatternsFound: [],
  safePatternsFound: [],
  filesWithIssues: new Set(),
  criticalIssues: 0,
  warnings: 0
};

// ========================================
// FUNCTIONS
// ========================================

function shouldScanFile(filePath) {
  const ext = path.extname(filePath);
  if (ext !== '.js') return false;
  
  return !CONFIG.excludePatterns.some(pattern => 
    filePath.includes(pattern)
  );
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const relativePath = path.relative(CONFIG.backendPath, filePath);
  const fileName = path.basename(filePath);
  
  results.filesScanned++;
  
  // Check for unsafe patterns
  UNSAFE_PATTERNS.forEach(({ name, pattern, severity, message, excludeFiles }) => {
    // Skip if this file is in the exclude list
    if (excludeFiles && excludeFiles.some(exclude => fileName.includes(exclude))) {
      return;
    }
    
    lines.forEach((line, lineNum) => {
      // Skip comments
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
      
      if (pattern.test(line)) {
        results.unsafePatternsFound.push({
          file: relativePath,
          line: lineNum + 1,
          pattern: name,
          severity,
          message,
          code: line.trim().substring(0, 80)
        });
        results.filesWithIssues.add(relativePath);
        
        if (severity === 'CRITICAL') {
          results.criticalIssues++;
        } else {
          results.warnings++;
        }
      }
    });
  });
  
  // Check for safe patterns
  SAFE_PATTERNS.forEach(({ name, pattern, required, message }) => {
    if (pattern.test(content)) {
      results.safePatternsFound.push({
        file: relativePath,
        pattern: name,
        message
      });
    }
  });
}

function scanDirectory(dirPath) {
  const items = fs.readdirSync(dirPath);
  
  items.forEach(item => {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (!CONFIG.excludePatterns.some(pattern => fullPath.includes(pattern))) {
        scanDirectory(fullPath);
      }
    } else if (stat.isFile() && shouldScanFile(fullPath)) {
      scanFile(fullPath);
    }
  });
}

function printReport() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║         NEON-SAFETY VERIFICATION REPORT                        ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');
  
  console.log(`📁 Files Scanned: ${results.filesScanned}`);
  console.log(`🔴 Critical Issues: ${results.criticalIssues}`);
  console.log(`⚠️  Warnings: ${results.warnings}`);
  console.log(`✅ Safe Patterns Found: ${results.safePatternsFound.length}`);
  console.log('');
  
  if (results.unsafePatternsFound.length > 0) {
    console.log('🔴 UNSAFE PATTERNS DETECTED (MUST FIX):');
    console.log('═══════════════════════════════════════════════════════════════');
    
    results.unsafePatternsFound.forEach((issue, index) => {
      console.log(`\n${index + 1}. [${issue.severity}] ${issue.pattern}`);
      console.log(`   File: ${issue.file}:${issue.line}`);
      console.log(`   Issue: ${issue.message}`);
      console.log(`   Code: ${issue.code}`);
    });
    
    console.log('\n═══════════════════════════════════════════════════════════════');
  }
  
  if (results.safePatternsFound.length > 0) {
    console.log('\n✅ SAFE PATTERNS DETECTED:');
    console.log('═══════════════════════════════════════════════════════════════');
    
    const uniquePatterns = [...new Set(results.safePatternsFound.map(p => p.pattern))];
    uniquePatterns.forEach(pattern => {
      console.log(`  ✓ ${pattern}`);
    });
    
    console.log('═══════════════════════════════════════════════════════════════');
  }
  
  console.log('\n');
}

function printFinalVerdict() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                  FINAL VERDICT                                 ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');
  
  // Check required patterns
  const hasTransactionHook = results.safePatternsFound.some(p => 
    p.pattern === 'Global transaction enforcement hook'
  );
  const hasExecuteMethods = results.safePatternsFound.some(p => 
    p.pattern === 'executeWithTenant usage'
  );
  const hasSafeMiddleware = results.safePatternsFound.some(p => 
    p.pattern === 'Neon-safe middleware'
  );
  
  console.log('Required Safety Components:');
  console.log(`  ${hasTransactionHook ? '✅' : '❌'} Global transaction enforcement hook`);
  console.log(`  ${hasExecuteMethods ? '✅' : '❌'} Transaction-safe execution methods`);
  console.log(`  ${hasSafeMiddleware ? '✅' : '❌'} Neon-safe middleware`);
  console.log('');
  
  if (results.criticalIssues === 0 && hasTransactionHook && hasExecuteMethods && hasSafeMiddleware) {
    console.log('🎉 VERDICT: SYSTEM IS NEON-SAFE ✅');
    console.log('');
    console.log('All critical issues have been resolved.');
    console.log('The system is ready for Neon production deployment.');
    console.log('');
    console.log('FINAL SCORE: 10/10 ✅');
    return 0;
  } else {
    console.log('❌ VERDICT: SYSTEM IS NOT NEON-SAFE ❌');
    console.log('');
    console.log(`Found ${results.criticalIssues} critical issues that must be fixed.`);
    console.log('');
    
    if (!hasTransactionHook) {
      console.log('❌ Missing: Global transaction enforcement hook');
      console.log('   Add to unified_database.js: sequelize.addHook("beforeQuery", ...)');
    }
    
    if (!hasExecuteMethods) {
      console.log('❌ Missing: Transaction-safe execution methods');
      console.log('   Use req.executeWithTenant() for all database operations');
    }
    
    if (!hasSafeMiddleware) {
      console.log('❌ Missing: Neon-safe middleware');
      console.log('   Use neonSafeTenantMiddleware in middleware chains');
    }
    
    console.log('');
    const score = Math.max(0, 10 - results.criticalIssues);
    console.log(`FINAL SCORE: ${score}/10 ❌`);
    return 1;
  }
}

// ========================================
// MAIN EXECUTION
// ========================================

console.log('🔍 Starting Neon-safety verification...');
console.log(`📁 Scanning: ${CONFIG.backendPath}`);
console.log('');

// Scan all relevant directories
CONFIG.allowedDirectories.forEach(dir => {
  const dirPath = path.join(CONFIG.backendPath, dir);
  if (fs.existsSync(dirPath)) {
    scanDirectory(dirPath);
  }
});

// Print results
printReport();

// Print final verdict
const exitCode = printFinalVerdict();

// Summary
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('Verification Summary:');
console.log(`- Files scanned: ${results.filesScanned}`);
console.log(`- Critical issues: ${results.criticalIssues}`);
console.log(`- Warnings: ${results.warnings}`);
console.log(`- Files with issues: ${results.filesWithIssues.size}`);
console.log('═══════════════════════════════════════════════════════════════');

process.exit(exitCode);
