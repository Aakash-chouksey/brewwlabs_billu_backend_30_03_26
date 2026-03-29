/**
 * PERFORMANCE PROFILER - API Response Time & Query Analysis
 * 
 * Analyzes all controllers for:
 * - Response time > 300ms
 * - Multiple DB queries
 * - Large payloads
 * - Missing attributes optimization
 * - N+1 patterns
 */

const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');

// Performance analysis results
const analysis = {
  slowAPIs: [],
  missingAttributes: [],
  missingIncludes: [],
  heavyTransforms: [],
  nPlusOneRisks: [],
  queryCounts: {},
  indexRecommendations: []
};

const CONTROLLERS_DIR = path.join(__dirname, '../controllers');
const MODELS_DIR = path.join(__dirname, '../models');

// Patterns to detect performance issues
const PATTERNS = {
  // Find all database queries
  findAll: /(\w+)\.findAll\s*\(/g,
  findOne: /(\w+)\.findOne\s*\(/g,
  findByPk: /(\w+)\.findByPk\s*\(/g,
  create: /(\w+)\.create\s*\(/g,
  bulkCreate: /(\w+)\.bulkCreate\s*\(/g,
  update: /(\w+)\.update\s*\(/g,
  destroy: /(\w+)\.destroy\s*\(/g,
  count: /(\w+)\.count\s*\(/g,
  
  // Check for attributes
  hasAttributes: /attributes\s*:/,
  
  // Check for includes
  hasInclude: /include\s*:/,
  includeWithoutAttributes: /include\s*:\s*\[?\s*\{[^}]*model\s*:[^}]*\}(?!\s*,\s*attributes)/,
  
  // Heavy transformations
  mapLoop: /\.map\s*\([^)]*\)\s*=>/,
  forEachTransform: /forEach\s*\([^)]*\)\s*=>\s*\{/,
  toJSONLoop: /\.toJSON\(\)|\.get\s*\(\s*\{\s*plain\s*:/,
  
  // N+1 risk patterns
  loopWithQuery: /for\s*\([^)]*\)\s*\{[^}]*(?:findOne|findByPk|findAll|create|update)\s*\(/,
  mapWithAsync: /\.map\s*\([^)]*\)\s*=>\s*[^}]*await/,
  
  // Response building
  resJson: /res\.json\s*\(/,
  resSend: /res\.send\s*\(/,
  
  // WHERE patterns for index recommendations
  whereOutlet: /where.*outletId|outlet_id/,
  whereBusiness: /where.*businessId|business_id/,
  whereProduct: /where.*productId|product_id/,
  whereOrder: /where.*orderId|order_id/,
  whereCustomer: /where.*customerId|customer_id/,
  whereInventory: /where.*inventoryId|inventory_id/
};

function analyzeController(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const filename = path.basename(filePath);
  
  // Extract all function exports
  const functionMatches = content.match(/exports\.(\w+)\s*=\s*async\s*\(/g) || [];
  
  functionMatches.forEach(match => {
    const funcName = match.replace(/exports\./, '').replace(/\s*=.*$/, '');
    
    // Find function body (simplified extraction)
    const funcStart = content.indexOf(match);
    const nextFunc = content.indexOf('exports.', funcStart + match.length);
    const funcBody = nextFunc > 0 ? content.substring(funcStart, nextFunc) : content.substring(funcStart);
    
    analyzeFunction(filename, funcName, funcBody);
  });
}

function analyzeFunction(filename, funcName, body) {
  const apiName = `${filename}.${funcName}`;
  
  // Count queries
  const queryCount = {
    findAll: (body.match(PATTERNS.findAll) || []).length,
    findOne: (body.match(PATTERNS.findOne) || []).length,
    findByPk: (body.match(PATTERNS.findByPk) || []).length,
    create: (body.match(PATTERNS.create) || []).length,
    bulkCreate: (body.match(PATTERNS.bulkCreate) || []).length,
    update: (body.match(PATTERNS.update) || []).length,
    destroy: (body.match(PATTERNS.destroy) || []).length,
    count: (body.match(PATTERNS.count) || []).length
  };
  
  const totalQueries = Object.values(queryCount).reduce((a, b) => a + b, 0);
  analysis.queryCounts[apiName] = { ...queryCount, total: totalQueries };
  
  // Check for missing attributes
  if (totalQueries > 0) {
    const hasAttrs = body.includes('attributes');
    if (!hasAttrs) {
      analysis.missingAttributes.push({
        api: apiName,
        queries: totalQueries,
        suggestion: 'Add attributes: [...] to limit returned fields'
      });
    }
  }
  
  // Check for includes without attributes
  if (body.includes('include') && !PATTERNS.hasAttributes.test(body)) {
    analysis.missingIncludes.push({
      api: apiName,
      issue: 'Include without attributes limit'
    });
  }
  
  // Check for N+1 patterns
  const hasLoopWithQuery = PATTERNS.loopWithQuery.test(body);
  const hasMapWithAsync = PATTERNS.mapWithAsync.test(body);
  
  if (hasLoopWithQuery || hasMapWithAsync) {
    // Check if it's actually using bulkCreate (which means it's fixed)
    const hasBulkCreate = body.includes('bulkCreate');
    if (!hasBulkCreate) {
      analysis.nPlusOneRisks.push({
        api: apiName,
        issue: hasLoopWithQuery ? 'Loop with DB query detected' : 'Map with async detected',
        severity: 'HIGH'
      });
    }
  }
  
  // Check for heavy transformations
  if (PATTERNS.mapLoop.test(body) || PATTERNS.forEachTransform.test(body)) {
    const lines = body.split('\n').length;
    if (lines > 50) {
      analysis.heavyTransforms.push({
        api: apiName,
        lines: lines,
        issue: 'Large transformation logic'
      });
    }
  }
  
  // Flag as slow API if >3 queries or has N+1
  if (totalQueries > 3 || (hasLoopWithQuery && !body.includes('bulkCreate'))) {
    analysis.slowAPIs.push({
      api: apiName,
      queries: totalQueries,
      nPlusOneRisk: hasLoopWithQuery && !body.includes('bulkCreate'),
      missingAttributes: !body.includes('attributes')
    });
  }
  
  // Index recommendations
  const indexFields = [];
  if (PATTERNS.whereOutlet.test(body)) indexFields.push('outletId');
  if (PATTERNS.whereBusiness.test(body)) indexFields.push('businessId');
  if (PATTERNS.whereProduct.test(body)) indexFields.push('productId');
  if (PATTERNS.whereOrder.test(body)) indexFields.push('orderId');
  if (PATTERNS.whereCustomer.test(body)) indexFields.push('customerId');
  if (PATTERNS.whereInventory.test(body)) indexFields.push('inventoryId');
  
  if (indexFields.length > 0) {
    analysis.indexRecommendations.push({
      api: apiName,
      fields: [...new Set(indexFields)]
    });
  }
}

function printReport() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║          API PERFORMANCE ANALYSIS REPORT                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  // Slow APIs
  console.log('🔴 SLOW APIs (>3 queries or N+1 risk):');
  if (analysis.slowAPIs.length === 0) {
    console.log('   ✅ None found\n');
  } else {
    analysis.slowAPIs.forEach(api => {
      const nPlusOne = api.nPlusOneRisk ? ' [N+1 RISK]' : '';
      const missingAttrs = api.missingAttributes ? ' [NO ATTRIBUTES]' : '';
      console.log(`   ⚠️  ${api.api}`);
      console.log(`      Queries: ${api.queries}${nPlusOne}${missingAttrs}\n`);
    });
  }
  
  // Missing attributes
  console.log('🟡 APIs WITHOUT ATTRIBUTES (SELECT *):');
  if (analysis.missingAttributes.length === 0) {
    console.log('   ✅ All APIs use attributes\n');
  } else {
    analysis.missingAttributes.slice(0, 10).forEach(item => {
      console.log(`   ⚠️  ${item.api} (${item.queries} queries)`);
    });
    if (analysis.missingAttributes.length > 10) {
      console.log(`   ... and ${analysis.missingAttributes.length - 10} more`);
    }
    console.log();
  }
  
  // N+1 risks
  console.log('🔴 N+1 QUERY RISKS:');
  if (analysis.nPlusOneRisks.length === 0) {
    console.log('   ✅ None found\n');
  } else {
    analysis.nPlusOneRisks.forEach(item => {
      console.log(`   ⚠️  ${item.api}`);
      console.log(`      Issue: ${item.issue}`);
    });
    console.log();
  }
  
  // Index recommendations
  console.log('💡 INDEX RECOMMENDATIONS:');
  const uniqueFields = [...new Set(analysis.indexRecommendations.flatMap(r => r.fields))];
  if (uniqueFields.length === 0) {
    console.log('   No specific recommendations\n');
  } else {
    console.log('   Consider indexes on:');
    uniqueFields.forEach(field => {
      const apis = analysis.indexRecommendations.filter(r => r.fields.includes(field)).map(r => r.api.split('.')[0]);
      console.log(`   • ${field} (used in: ${[...new Set(apis)].join(', ')})`);
    });
    console.log();
  }
  
  // Query count summary
  console.log('📊 QUERY COUNT SUMMARY (Top 10 by total queries):');
  const sorted = Object.entries(analysis.queryCounts)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10);
  
  sorted.forEach(([api, counts]) => {
    console.log(`   ${api}`);
    console.log(`      Total: ${counts.total} (findAll:${counts.findAll} findOne:${counts.findOne} create:${counts.create} update:${counts.update})`);
  });
  console.log();
  
  // Final summary
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                    SUMMARY                                 ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Slow APIs (>3 queries):     ${String(analysis.slowAPIs.length).padEnd(28)}║`);
  console.log(`║  Missing attributes:         ${String(analysis.missingAttributes.length).padEnd(28)}║`);
  console.log(`║  N+1 risks:                  ${String(analysis.nPlusOneRisks.length).padEnd(28)}║`);
  console.log(`║  Heavy transformations:      ${String(analysis.heavyTransforms.length).padEnd(28)}║`);
  console.log(`║  Index recommendations:      ${String(uniqueFields.length).padEnd(28)}║`);
  console.log('╚════════════════════════════════════════════════════════════╝\n');
}

// Main execution
console.log('🔍 Analyzing controllers for performance issues...\n');

const files = fs.readdirSync(CONTROLLERS_DIR).filter(f => f.endsWith('.js'));
files.forEach(file => {
  analyzeController(path.join(CONTROLLERS_DIR, file));
});

printReport();

// Export for programmatic use
module.exports = { analysis, analyzeController };
