#!/usr/bin/env node

/**
 * INFRASTRUCTURE VALIDATION
 * 
 * Validates if architecture supports horizontal scaling, load balancing, and stateless design
 */

const fs = require('fs');
const path = require('path');

class InfrastructureValidation {
    constructor() {
        this.infrastructureIssues = [];
        this.scalabilityLimitations = [];
        this.deploymentRisks = [];
    }

    /**
     * Test horizontal scaling capability
     */
    async testHorizontalScaling() {
        console.log('🔍 Testing horizontal scaling capability...');
        
        // Check if application is stateless
        const appPath = path.join(__dirname, '../app.js');
        if (fs.existsSync(appPath)) {
            const content = fs.readFileSync(appPath, 'utf8');
            
            // Look for in-memory state storage
            const stateStoragePatterns = [
                /let\s+\w+\s*=\s*\[\]/g,
                /let\s+\w+\s*=\s*\{\}/g,
                /const\s+\w+\s*=\s*\[\]/g,
                /const\s+\w+\s*=\s*\{\}/g
            ];
            
            for (const pattern of stateStoragePatterns) {
                const matches = content.match(pattern);
                if (matches) {
                    this.infrastructureIssues.push({
                        component: 'Stateless Design',
                        issue: `In-memory state storage detected: ${matches.length} instances`,
                        severity: 'CRITICAL',
                        impact: 'Cannot horizontally scale with stateful design'
                    });
                }
            }
        }
        
        // Check session storage
        const controllersDir = path.join(__dirname, '../controllers');
        const controllerFiles = fs.readdirSync(controllersDir).filter(f => f.endsWith('.js'));
        
        let hasSessionStorage = false;
        for (const file of controllerFiles) {
            const filePath = path.join(controllersDir, file);
            const content = fs.readFileSync(filePath, 'utf8');
            
            if (content.includes('session') || content.includes('req.session')) {
                hasSessionStorage = true;
                this.infrastructureIssues.push({
                    component: 'Session Management',
                    issue: 'Server-side session storage detected',
                    severity: 'HIGH',
                    impact: 'Sticky sessions required for horizontal scaling'
                });
            }
        }
        
        // Check file uploads
        const uploadControllerPath = path.join(__dirname, '../controllers/uploadController.js');
        if (fs.existsSync(uploadControllerPath)) {
            const content = fs.readFileSync(uploadControllerPath, 'utf8');
            
            const hasLocalFileStorage = content.includes('fs.') || content.includes('uploads/');
            if (hasLocalFileStorage) {
                this.infrastructureIssues.push({
                    component: 'File Storage',
                    issue: 'Local file storage detected',
                    severity: 'HIGH',
                    impact: 'Files not shared across instances'
                });
            }
        }
        
        console.log(`   ✅ Horizontal scaling analysis complete`);
    }

    /**
     * Test load balancing readiness
     */
    async testLoadBalancing() {
        console.log('🔍 Testing load balancing readiness...');
        
        // Check for health endpoints
        const appPath = path.join(__dirname, '../app.js');
        if (fs.existsSync(appPath)) {
            const content = fs.readFileSync(appPath, 'utf8');
            
            const hasHealthEndpoint = content.includes('/health') || content.includes('health');
            if (!hasHealthEndpoint) {
                this.infrastructureIssues.push({
                    component: 'Load Balancing',
                    issue: 'No health check endpoint',
                    severity: 'HIGH',
                    impact: 'Load balancer cannot detect instance health'
                });
            }
            
            const hasReadinessEndpoint = content.includes('/ready') || content.includes('readiness');
            if (!hasReadinessEndpoint) {
                this.infrastructureIssues.push({
                    component: 'Load Balancing',
                    issue: 'No readiness check endpoint',
                    severity: 'MEDIUM',
                    impact: 'Load balancer may route to unready instances'
                });
            }
        }
        
        // Check for WebSocket support
        const hasWebSocket = fs.existsSync(appPath) && fs.readFileSync(appPath, 'utf8').includes('socket.io');
        if (hasWebSocket) {
            this.infrastructureIssues.push({
                component: 'Load Balancing',
                issue: 'WebSocket connections require sticky sessions',
                severity: 'HIGH',
                impact: 'Complex load balancing configuration needed'
            });
        }
        
        console.log(`   ✅ Load balancing analysis complete`);
    }

    /**
     * Test Redis clustering readiness
     */
    async testRedisClustering() {
        console.log('🔍 Testing Redis clustering readiness...');
        
        const redisPath = path.join(__dirname, '../src/cache/redisClient.js');
        if (fs.existsSync(redisPath)) {
            const content = fs.readFileSync(redisPath, 'utf8');
            
            // Check for Redis clustering configuration
            const hasClustering = content.includes('cluster') || content.includes('Redis.Cluster');
            if (!hasClustering) {
                this.infrastructureIssues.push({
                    component: 'Redis Clustering',
                    issue: 'Single Redis instance configuration',
                    severity: 'HIGH',
                    impact: 'Redis becomes single point of failure'
                });
            }
            
            // Check for Redis failover
            const hasFailover = content.includes('sentinel') || content.includes('failover');
            if (!hasFailover) {
                this.infrastructureIssues.push({
                    component: 'Redis Failover',
                    issue: 'No Redis failover configuration',
                    severity: 'HIGH',
                    impact: 'Redis downtime will crash application'
                });
            }
            
            // Check for connection pooling
            const hasConnectionPooling = content.includes('pool') || content.includes('maxRetriesPerRequest');
            if (!hasConnectionPooling) {
                this.infrastructureIssues.push({
                    component: 'Redis Connection Pooling',
                    issue: 'No Redis connection pooling',
                    severity: 'MEDIUM',
                    impact: 'Inefficient Redis connection usage'
                });
            }
        } else {
            this.infrastructureIssues.push({
                component: 'Redis Integration',
                issue: 'Redis client not properly integrated',
                severity: 'HIGH',
                impact: 'No caching or session management'
            });
        }
        
        console.log(`   ✅ Redis clustering analysis complete`);
    }

    /**
     * Test database replication readiness
     */
    async testDatabaseReplication() {
        console.log('🔍 Testing database replication readiness...');
        
        // Check tenant connection factory for read replica support
        const factoryPath = path.join(__dirname, '../src/services/tenantConnectionFactory.js');
        if (fs.existsSync(factoryPath)) {
            const content = fs.readFileSync(factoryPath, 'utf8');
            
            const hasReadReplicas = content.includes('readReplica') || content.includes('replica');
            if (!hasReadReplicas) {
                this.infrastructureIssues.push({
                    component: 'Database Replication',
                    issue: 'No read replica configuration',
                    severity: 'HIGH',
                    impact: 'All queries hit primary database'
                });
            }
            
            const hasWriteSplitting = content.includes('readWriteSplitting') || content.includes('rwSplitting');
            if (!hasWriteSplitting) {
                this.infrastructureIssues.push({
                    component: 'Database Read/Write Splitting',
                    issue: 'No read/write splitting',
                    severity: 'HIGH',
                    impact: 'Read queries not offloaded to replicas'
                });
            }
        }
        
        // Check for database connection string configuration
        const envPath = path.join(__dirname, '../.env.example');
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf8');
            
            const hasReplicaConfig = content.includes('READ_REPLICA_URL') || content.includes('REPLICA');
            if (!hasReplicaConfig) {
                this.infrastructureIssues.push({
                    component: 'Database Configuration',
                    issue: 'No read replica configuration in environment',
                    severity: 'MEDIUM',
                    impact: 'Replica setup not documented'
                });
            }
        }
        
        console.log(`   ✅ Database replication analysis complete`);
    }

    /**
     * Test containerization readiness
     */
    async testContainerization() {
        console.log('🔍 Testing containerization readiness...');
        
        // Check for Dockerfile
        const dockerfilePath = path.join(__dirname, '../Dockerfile');
        if (!fs.existsSync(dockerfilePath)) {
            this.infrastructureIssues.push({
                component: 'Containerization',
                issue: 'No Dockerfile found',
                severity: 'MEDIUM',
                impact: 'Cannot containerize application'
            });
        } else {
            const dockerContent = fs.readFileSync(dockerfilePath, 'utf8');
            
            // Check for multi-stage build
            const hasMultiStage = dockerContent.includes('AS builder') || dockerContent.includes('FROM.*AS');
            if (!hasMultiStage) {
                this.infrastructureIssues.push({
                    component: 'Docker Optimization',
                    issue: 'No multi-stage Docker build',
                    severity: 'LOW',
                    impact: 'Larger Docker image size'
                });
            }
            
            // Check for health check in Dockerfile
            const hasDockerHealthCheck = dockerContent.includes('HEALTHCHECK');
            if (!hasDockerHealthCheck) {
                this.infrastructureIssues.push({
                    component: 'Docker Health Check',
                    issue: 'No Docker health check',
                    severity: 'LOW',
                    impact: 'Container health not monitored'
                });
            }
        }
        
        // Check for docker-compose
        const dockerComposePath = path.join(__dirname, '../docker-compose.yml');
        if (!fs.existsSync(dockerComposePath)) {
            this.infrastructureIssues.push({
                component: 'Development Environment',
                issue: 'No docker-compose.yml found',
                severity: 'LOW',
                impact: 'Development setup not containerized'
            });
        }
        
        console.log(`   ✅ Containerization analysis complete`);
    }

    /**
     * Test environment configuration
     */
    async testEnvironmentConfiguration() {
        console.log('🔍 Testing environment configuration...');
        
        const envPath = path.join(__dirname, '../.env.example');
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf8');
            
            // Check for production-ready configurations
            const requiredProductionVars = [
                'NODE_ENV',
                'DATABASE_URL',
                'CONTROL_PLANE_DATABASE_URL',
                'REDIS_URL',
                'JWT_SECRET'
            ];
            
            for (const varName of requiredProductionVars) {
                if (!content.includes(varName)) {
                    this.infrastructureIssues.push({
                        component: 'Environment Configuration',
                        issue: `Missing required environment variable: ${varName}`,
                        severity: 'HIGH',
                        impact: 'Production deployment will fail'
                    });
                }
            }
            
            // Check for security configurations
            const securityVars = ['ENCRYPTION_KEY', 'JWT_SECRET'];
            for (const varName of securityVars) {
                if (content.includes(`${varName}="your_`) || content.includes(`${varName}="default`)) {
                    this.infrastructureIssues.push({
                        component: 'Security Configuration',
                        issue: `Default/insecure value for ${varName}`,
                        severity: 'CRITICAL',
                        impact: 'Security vulnerability in production'
                    });
                }
            }
        }
        
        console.log(`   ✅ Environment configuration analysis complete`);
    }

    /**
     * Calculate infrastructure requirements
     */
    calculateInfrastructureRequirements() {
        console.log('🔍 Calculating infrastructure requirements...');
        
        const tenants = 10000;
        const terminalsPerTenant = 5;
        const ordersPerMinutePerTerminal = 2;
        
        // Calculate memory requirements
        const memoryPerInstance = 512; // MB
        const requiredInstances = Math.ceil(tenants / 1000); // 1000 tenants per instance
        const totalMemoryRequired = (requiredInstances * memoryPerInstance) / 1024; // GB
        
        console.log(`   📊 Infrastructure Requirements:`);
        console.log(`      Target Tenants: ${tenants.toLocaleString()}`);
        console.log(`      Required Instances: ${requiredInstances}`);
        console.log(`      Memory per Instance: ${memoryPerInstance}MB`);
        console.log(`      Total Memory Required: ${totalMemoryRequired.toFixed(2)}GB`);
        
        // Calculate database requirements
        const connectionsPerInstance = 100;
        const totalDatabaseConnections = requiredInstances * connectionsPerInstance;
        
        console.log(`      Database Connections per Instance: ${connectionsPerInstance}`);
        console.log(`      Total Database Connections: ${totalDatabaseConnections.toLocaleString()}`);
        
        // Check if requirements are realistic
        if (totalMemoryRequired > 16) {
            this.scalabilityLimitations.push({
                component: 'Memory Requirements',
                issue: `Requires ${totalMemoryRequired.toFixed(2)}GB RAM for horizontal scaling`,
                severity: 'HIGH',
                impact: 'High infrastructure cost'
            });
        }
        
        if (totalDatabaseConnections > 1000) {
            this.scalabilityLimitations.push({
                component: 'Database Connections',
                issue: `Requires ${totalDatabaseConnections.toLocaleString()} database connections`,
                severity: 'HIGH',
                impact: 'Database connection pool exhaustion'
            });
        }
        
        console.log(`   ✅ Infrastructure requirements calculation complete`);
    }

    /**
     * Generate infrastructure validation report
     */
    generateReport() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 INFRASTRUCTURE VALIDATION REPORT');
        console.log('='.repeat(80));
        
        // Group by severity
        const criticalIssues = this.infrastructureIssues.filter(i => i.severity === 'CRITICAL');
        const highIssues = this.infrastructureIssues.filter(i => i.severity === 'HIGH');
        const mediumIssues = this.infrastructureIssues.filter(i => i.severity === 'MEDIUM');
        const lowIssues = this.infrastructureIssues.filter(i => i.severity === 'LOW');
        
        console.log(`\n🚨 CRITICAL INFRASTRUCTURE ISSUES (${criticalIssues.length}):`);
        criticalIssues.forEach((issue, index) => {
            console.log(`   ${index + 1}. 🔴 ${issue.component}:`);
            console.log(`      Issue: ${issue.issue}`);
            console.log(`      Impact: ${issue.impact}`);
        });
        
        console.log(`\n⚠️  HIGH INFRASTRUCTURE ISSUES (${highIssues.length}):`);
        highIssues.forEach((issue, index) => {
            console.log(`   ${index + 1}. 🟡 ${issue.component}:`);
            console.log(`      Issue: ${issue.issue}`);
            console.log(`      Impact: ${issue.impact}`);
        });
        
        console.log(`\n💡 MEDIUM INFRASTRUCTURE ISSUES (${mediumIssues.length}):`);
        mediumIssues.forEach((issue, index) => {
            console.log(`   ${index + 1}. 🟠 ${issue.component}:`);
            console.log(`      Issue: ${issue.issue}`);
            console.log(`      Impact: ${issue.impact}`);
        });
        
        console.log(`\n🔍 LOW INFRASTRUCTURE ISSUES (${lowIssues.length}):`);
        lowIssues.forEach((issue, index) => {
            console.log(`   ${index + 1}. 🔵 ${issue.component}:`);
            console.log(`      Issue: ${issue.issue}`);
            console.log(`      Impact: ${issue.impact}`);
        });
        
        console.log(`\n🏗️ SCALABILITY LIMITATIONS (${this.scalabilityLimitations.length}):`);
        this.scalabilityLimitations.forEach((limitation, index) => {
            console.log(`   ${index + 1}. ⚠️ ${limitation.component}:`);
            console.log(`      Issue: ${limitation.issue}`);
            console.log(`      Impact: ${limitation.impact}`);
        });
        
        // Calculate infrastructure score
        const criticalWeight = criticalIssues.length * 3;
        const highWeight = highIssues.length * 2;
        const mediumWeight = mediumIssues.length * 1;
        const lowWeight = lowIssues.length * 0.5;
        const limitationWeight = this.scalabilityLimitations.length * 2;
        
        const totalWeight = criticalWeight + highWeight + mediumWeight + lowWeight + limitationWeight;
        const infrastructureScore = Math.max(0, 10 - totalWeight);
        
        console.log(`\n🎯 INFRASTRUCTURE SCORE: ${infrastructureScore.toFixed(1)}/10`);
        
        return {
            criticalIssues: criticalIssues.length,
            highIssues: highIssues.length,
            mediumIssues: mediumIssues.length,
            lowIssues: lowIssues.length,
            scalabilityLimitations: this.scalabilityLimitations.length,
            infrastructureScore,
            isInfrastructureReady: criticalIssues.length === 0 && highIssues.length <= 3
        };
    }

    /**
     * Run comprehensive infrastructure validation
     */
    async runInfrastructureValidation() {
        console.log('🔥 COMPREHENSIVE INFRASTRUCTURE VALIDATION');
        console.log('='.repeat(50));
        
        await this.testHorizontalScaling();
        await this.testLoadBalancing();
        await this.testRedisClustering();
        await this.testDatabaseReplication();
        await this.testContainerization();
        await this.testEnvironmentConfiguration();
        this.calculateInfrastructureRequirements();
        
        return this.generateReport();
    }
}

if (require.main === module) {
    const validation = new InfrastructureValidation();
    validation.runInfrastructureValidation()
        .then(results => {
            console.log(`\n🏁 Infrastructure Validation Complete`);
            console.log(`   Infrastructure Ready: ${results.isInfrastructureReady ? '✅' : '❌'}`);
            process.exit(results.isInfrastructureReady ? 0 : 1);
        })
        .catch(error => {
            console.error('❌ Infrastructure validation failed:', error);
            process.exit(1);
        });
}

module.exports = InfrastructureValidation;
