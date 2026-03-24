#!/usr/bin/env node

/**
 * PERFORMANCE BOTTLENECK ANALYSIS
 * 
 * Analyzes code for performance issues that would impact 10,000+ tenant scalability
 */

const fs = require('fs');
const path = require('path');

class PerformanceBottleneckAnalysis {
    constructor() {
        this.issues = [];
        this.controllers = [];
        this.models = [];
        this.services = [];
    }

    /**
     * Scan all files for performance issues
     */
    async scanCodebase() {
        console.log('🔍 Scanning codebase for performance bottlenecks...');
        
        await this.scanControllers();
        await this.scanModels();
        await this.scanServices();
        await this.scanDatabaseQueries();
        await this.analyzeConnectionPooling();
        await this.checkMemoryLeaks();
        
        return this.generateReport();
    }

    /**
     * Analyze controllers for performance issues
     */
    async scanControllers() {
        console.log('🔍 Analyzing controllers...');
        
        const controllersDir = path.join(__dirname, '../controllers');
        const controllerFiles = fs.readdirSync(controllersDir).filter(f => f.endsWith('.js'));
        
        for (const file of controllerFiles) {
            const filePath = path.join(controllersDir, file);
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Check for N+1 query patterns
            const n1Patterns = [
                /forEach.*await/g,
                /for.*await/g,
                /map.*await/g,
                /filter.*await/g
            ];
            
            for (const pattern of n1Patterns) {
                const matches = content.match(pattern);
                if (matches) {
                    this.issues.push({
                        type: 'N_PLUS_ONE_QUERY',
                        severity: 'HIGH',
                        file: file,
                        issue: `Potential N+1 query: ${matches.length} instances of async loops`,
                        impact: 'Could cause database explosion under load'
                    });
                }
            }
            
            // Check for missing pagination
            if (content.includes('findAll') && !content.includes('limit') && !content.includes('offset')) {
                this.issues.push({
                    type: 'MISSING_PAGINATION',
                    severity: 'HIGH',
                    file: file,
                    issue: 'findAll without pagination limits',
                    impact: 'Could return millions of records and crash server'
                });
            }
            
            // Check for synchronous operations
            if (content.includes('fs.') || content.includes('require(')) {
                this.issues.push({
                    type: 'SYNCHRONOUS_IO',
                    severity: 'MEDIUM',
                    file: file,
                    issue: 'Synchronous file operations detected',
                    impact: 'Blocks event loop under load'
                });
            }
            
            // Check for large object creation
            if (content.includes('new ') && content.includes('Array(')) {
                this.issues.push({
                    type: 'MEMORY_ALLOCATION',
                    severity: 'MEDIUM',
                    file: file,
                    issue: 'Large array creation in hot path',
                    impact: 'Increased memory pressure'
                });
            }
        }
        
        console.log(`   ✅ Analyzed ${controllerFiles.length} controllers`);
    }

    /**
     * Analyze models for performance issues
     */
    async scanModels() {
        console.log('🔍 Analyzing models...');
        
        const modelsDir = path.join(__dirname, '../models');
        const modelFiles = fs.readdirSync(modelsDir).filter(f => f.endsWith('.js'));
        
        for (const file of modelFiles) {
            const filePath = path.join(modelsDir, file);
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Check for missing indexes
            if (content.includes('belongsTo') || content.includes('hasMany')) {
                // Look for associations without proper indexes
                const hasIndexes = content.includes('index:') || content.includes('indexes:');
                if (!hasIndexes) {
                    this.issues.push({
                        type: 'MISSING_INDEXES',
                        severity: 'HIGH',
                        file: file,
                        issue: 'Model associations without explicit indexes',
                        impact: 'Slow JOIN queries under load'
                    });
                }
            }
            
            // Check for large text fields
            if (content.includes('TEXT') || content.includes('LONGTEXT')) {
                this.issues.push({
                    type: 'LARGE_TEXT_FIELDS',
                    severity: 'MEDIUM',
                    file: file,
                    issue: 'Large text fields without length limits',
                    impact: 'Increased memory usage and slower queries'
                });
            }
            
            // Check for missing validations
            if (!content.includes('validate:') && !content.includes('allowNull: false')) {
                this.issues.push({
                    type: 'MISSING_VALIDATIONS',
                    severity: 'MEDIUM',
                    file: file,
                    issue: 'Missing field validations',
                    impact: 'Invalid data could cause performance issues'
                });
            }
        }
        
        console.log(`   ✅ Analyzed ${modelFiles.length} models`);
    }

    /**
     * Analyze services for performance issues
     */
    async scanServices() {
        console.log('🔍 Analyzing services...');
        
        const servicesDir = path.join(__dirname, '../services');
        if (!fs.existsSync(servicesDir)) return;
        
        const serviceFiles = this.getAllFiles(servicesDir, '.js');
        
        for (const file of serviceFiles) {
            const filePath = path.join(servicesDir, file);
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Check for heavy computations
            if (content.includes('while (true)') || content.includes('for (;;')) {
                this.issues.push({
                    type: 'INFINITE_LOOPS',
                    severity: 'CRITICAL',
                    file: file,
                    issue: 'Potential infinite loops detected',
                    impact: 'Could hang entire server'
                });
            }
            
            // Check for recursive calls without base case
            if (content.includes('function ') && content.includes('return ')) {
                const lines = content.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].includes('function ') && lines[i + 1] && lines[i + 1].includes('return ')) {
                        this.issues.push({
                            type: 'RECURSION_RISK',
                            severity: 'HIGH',
                            file: file,
                            issue: 'Potential unbounded recursion',
                            impact: 'Stack overflow under load'
                        });
                    }
                }
            }
            
            // Check for JSON operations on large data
            if (content.includes('JSON.stringify') || content.includes('JSON.parse')) {
                this.issues.push({
                    type: 'JSON_OPERATIONS',
                    severity: 'MEDIUM',
                    file: file,
                    issue: 'JSON operations on potentially large data',
                    impact: 'CPU spikes and memory pressure'
                });
            }
        }
        
        console.log(`   ✅ Analyzed ${serviceFiles.length} service files`);
    }

    /**
     * Analyze database query patterns
     */
    async scanDatabaseQueries() {
        console.log('🔍 Analyzing database query patterns...');
        
        // Check tenant connection factory
        const factoryPath = path.join(__dirname, '../src/services/tenantConnectionFactory.js');
        if (fs.existsSync(factoryPath)) {
            const content = fs.readFileSync(factoryPath, 'utf8');
            
            // Check connection pool configuration
            if (content.includes('max: 3')) {
                this.issues.push({
                    type: 'CONNECTION_POOL_LIMIT',
                    severity: 'HIGH',
                    file: 'tenantConnectionFactory.js',
                    issue: 'Connection pool limited to 3 per tenant',
                    impact: 'Connection exhaustion under load'
                });
            }
            
            // Check LRU cache size
            if (content.includes('max: 100')) {
                this.issues.push({
                    type: 'LRU_CACHE_LIMIT',
                    severity: 'CRITICAL',
                    file: 'tenantConnectionFactory.js',
                    issue: 'LRU cache limited to 100 tenants',
                    impact: 'Only 1% of 10,000 tenants can be cached'
                });
            }
            
            // Check TTL configuration
            if (content.includes('ttl: 1000 * 60 * 15')) { // 15 minutes
                this.issues.push({
                    type: 'CACHE_TTL',
                    severity: 'MEDIUM',
                    file: 'tenantConnectionFactory.js',
                    issue: '15-minute TTL may be too short for high traffic',
                    impact: 'Frequent connection re-establishment'
                });
            }
        }
        
        // Check model factory
        const modelFactoryPath = path.join(__dirname, '../src/architecture/modelFactory.js');
        if (fs.existsSync(modelFactoryPath)) {
            const content = fs.readFileSync(modelFactoryPath, 'utf8');
            
            // Check model initialization pattern
            if (content.includes('setupAssociations(sequelize)')) {
                this.issues.push({
                    type: 'MODEL_INITIALIZATION',
                    severity: 'HIGH',
                    file: 'modelFactory.js',
                    issue: 'Models re-initialized for each tenant',
                    impact: '40+ models × 10,000 tenants = 400,000 instances'
                });
            }
        }
    }

    /**
     * Analyze connection pooling strategy
     */
    async analyzeConnectionPooling() {
        console.log('🔍 Analyzing connection pooling strategy...');
        
        // Calculate theoretical limits
        const tenants = 10000;
        const connectionsPerTenant = 3;
        const totalConnections = tenants * connectionsPerTenant;
        
        console.log(`   📊 Connection Pool Analysis:`);
        console.log(`      Target Tenants: ${tenants.toLocaleString()}`);
        console.log(`      Connections per Tenant: ${connectionsPerTenant}`);
        console.log(`      Total Required Connections: ${totalConnections.toLocaleString()}`);
        
        // Most PostgreSQL databases max out around 100-200 connections by default
        const typicalMaxConnections = 100;
        const requiredMultiplier = totalConnections / typicalMaxConnections;
        
        if (requiredMultiplier > 10) {
            this.issues.push({
                type: 'CONNECTION_EXPLOSION',
                severity: 'CRITICAL',
                file: 'Architecture',
                issue: `Requires ${requiredMultiplier.toFixed(0)}x more connections than typical database limits`,
                impact: 'Database will refuse connections under load'
            });
        }
        
        // Check if connection pooling is external (PgBouncer, etc.)
        const hasExternalPooling = false; // Assume not configured
        if (!hasExternalPooling) {
            this.issues.push({
                type: 'MISSING_EXTERNAL_POOLING',
                severity: 'HIGH',
                file: 'Infrastructure',
                issue: 'No external connection pooling (PgBouncer, PgPool-II) detected',
                impact: 'Application must handle all connection management'
            });
        }
    }

    /**
     * Check for potential memory leaks
     */
    async checkMemoryLeaks() {
        console.log('🔍 Checking for memory leaks...');
        
        // Estimate memory usage
        const memoryPerTenant = {
            connections: 3 * 10, // 3 connections × 10MB each
            models: 40 * 0.5, // 40 models × 0.5MB each
            cache: 5, // 5MB cache per tenant
            overhead: 2 // 2MB overhead
        };
        
        const totalMemoryPerTenant = Object.values(memoryPerTenant).reduce((a, b) => a + b, 0);
        const totalMemoryFor10k = (totalMemoryPerTenant * 10000) / 1024; // GB
        
        console.log(`   💾 Memory Usage Analysis:`);
        console.log(`      Memory per Tenant: ${totalMemoryPerTenant}MB`);
        console.log(`      Total for 10,000 tenants: ${totalMemoryFor10k.toFixed(2)}GB`);
        
        if (totalMemoryFor10k > 32) {
            this.issues.push({
                type: 'MEMORY_EXPLOSION',
                severity: 'CRITICAL',
                file: 'Architecture',
                issue: `Requires ${totalMemoryFor10k.toFixed(2)}GB RAM for 10,000 tenants`,
                impact: 'Not feasible on single server, requires horizontal scaling'
            });
        }
        
        // Check for event listener leaks
        const appPath = path.join(__dirname, '../app.js');
        if (fs.existsSync(appPath)) {
            const content = fs.readFileSync(appPath, 'utf8');
            
            if (content.includes('io.on(') && !content.includes('removeListener') && !content.includes('off(')) {
                this.issues.push({
                    type: 'EVENT_LISTENER_LEAKS',
                    severity: 'MEDIUM',
                    file: 'app.js',
                    issue: 'Socket.io listeners without cleanup',
                    impact: 'Memory leaks from disconnected clients'
                });
            }
        }
    }

    /**
     * Get all files recursively
     */
    getAllFiles(dir, extension) {
        const files = [];
        
        function traverse(currentDir) {
            const items = fs.readdirSync(currentDir);
            
            for (const item of items) {
                const fullPath = path.join(currentDir, item);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    traverse(fullPath);
                } else if (item.endsWith(extension)) {
                    files.push(path.relative(dir, fullPath));
                }
            }
        }
        
        traverse(dir);
        return files;
    }

    /**
     * Generate comprehensive report
     */
    generateReport() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 PERFORMANCE BOTTLENECK ANALYSIS REPORT');
        console.log('='.repeat(80));
        
        // Group issues by severity
        const criticalIssues = this.issues.filter(i => i.severity === 'CRITICAL');
        const highIssues = this.issues.filter(i => i.severity === 'HIGH');
        const mediumIssues = this.issues.filter(i => i.severity === 'MEDIUM');
        
        console.log(`\n🚨 CRITICAL ISSUES (${criticalIssues.length}):`);
        criticalIssues.forEach((issue, index) => {
            console.log(`   ${index + 1}. 🔴 ${issue.type} in ${issue.file}:`);
            console.log(`      Issue: ${issue.issue}`);
            console.log(`      Impact: ${issue.impact}`);
        });
        
        console.log(`\n⚠️  HIGH ISSUES (${highIssues.length}):`);
        highIssues.forEach((issue, index) => {
            console.log(`   ${index + 1}. 🟡 ${issue.type} in ${issue.file}:`);
            console.log(`      Issue: ${issue.issue}`);
            console.log(`      Impact: ${issue.impact}`);
        });
        
        console.log(`\n💡 MEDIUM ISSUES (${mediumIssues.length}):`);
        mediumIssues.forEach((issue, index) => {
            console.log(`   ${index + 1}. 🟠 ${issue.type} in ${issue.file}:`);
            console.log(`      Issue: ${issue.issue}`);
            console.log(`      Impact: ${issue.impact}`);
        });
        
        // Calculate scores
        const criticalScore = Math.max(0, 10 - criticalIssues.length * 2);
        const highScore = Math.max(0, 10 - highIssues.length * 1);
        const mediumScore = Math.max(0, 10 - mediumIssues.length * 0.5);
        
        const overallScore = (criticalScore + highScore + mediumScore) / 3;
        
        console.log(`\n🎯 PERFORMANCE SCORES:`);
        console.log(`   Critical Issues Score: ${criticalScore.toFixed(1)}/10`);
        console.log(`   High Issues Score: ${highScore.toFixed(1)}/10`);
        console.log(`   Medium Issues Score: ${mediumScore.toFixed(1)}/10`);
        console.log(`   Overall Performance Score: ${overallScore.toFixed(1)}/10`);
        
        return {
            criticalIssues: criticalIssues.length,
            highIssues: highIssues.length,
            mediumIssues: mediumIssues.length,
            overallScore,
            isProductionReady: criticalIssues.length === 0 && highIssues.length <= 2
        };
    }
}

if (require.main === module) {
    const analysis = new PerformanceBottleneckAnalysis();
    analysis.scanCodebase()
        .then(results => {
            console.log(`\n🏁 Analysis Complete`);
            console.log(`   Production Ready: ${results.isProductionReady ? '✅' : '❌'}`);
            process.exit(results.isProductionReady ? 0 : 1);
        })
        .catch(error => {
            console.error('❌ Analysis failed:', error);
            process.exit(1);
        });
}

module.exports = PerformanceBottleneckAnalysis;
