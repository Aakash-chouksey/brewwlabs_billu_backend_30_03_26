#!/usr/bin/env node

/**
 * MONITORING & ALERTING REVIEW
 * 
 * Reviews monitoring, logging, and alerting capabilities for production readiness
 */

const fs = require('fs');
const path = require('path');

class MonitoringAlertingReview {
    constructor() {
        this.monitoringGaps = [];
        this.alertingGaps = [];
        this.loggingIssues = [];
    }

    /**
     * Review error tracking capabilities
     */
    async reviewErrorTracking() {
        console.log('🔍 Reviewing error tracking capabilities...');
        
        // Check for global error handler
        const appPath = path.join(__dirname, '../app.js');
        if (fs.existsSync(appPath)) {
            const content = fs.readFileSync(appPath, 'utf8');
            
            const hasGlobalErrorHandler = content.includes('app.use(') && content.includes('error');
            if (!hasGlobalErrorHandler) {
                this.monitoringGaps.push({
                    component: 'Error Tracking',
                    issue: 'No global error handler',
                    severity: 'HIGH',
                    impact: 'Unhandled errors will crash the application'
                });
            }
            
            // Check for error logging
            const hasErrorLogging = content.includes('console.error') || content.includes('logger.error');
            if (!hasErrorLogging) {
                this.monitoringGaps.push({
                    component: 'Error Logging',
                    issue: 'No error logging implementation',
                    severity: 'HIGH',
                    impact: 'Errors not tracked for debugging'
                });
            }
        }
        
        // Check for structured logging
        const controllersDir = path.join(__dirname, '../controllers');
        const controllerFiles = fs.readdirSync(controllersDir).filter(f => f.endsWith('.js'));
        
        let hasStructuredLogging = false;
        for (const file of controllerFiles) {
            const filePath = path.join(controllersDir, file);
            const content = fs.readFileSync(filePath, 'utf8');
            
            if (content.includes('logger.') || content.includes('winston') || content.includes('bunyan')) {
                hasStructuredLogging = true;
                break;
            }
        }
        
        if (!hasStructuredLogging) {
            this.monitoringGaps.push({
                component: 'Structured Logging',
                issue: 'No structured logging library',
                severity: 'MEDIUM',
                impact: 'Poor log formatting and analysis'
            });
        }
        
        console.log(`   ✅ Error tracking review complete`);
    }

    /**
     * Review performance monitoring
     */
    async reviewPerformanceMonitoring() {
        console.log('🔍 Reviewing performance monitoring...');
        
        // Check for response time tracking
        const appPath = path.join(__dirname, '../app.js');
        if (fs.existsSync(appPath)) {
            const content = fs.readFileSync(appPath, 'utf8');
            
            const hasResponseTimeTracking = content.includes('response-time') || content.includes('duration') || content.includes('performance');
            if (!hasResponseTimeTracking) {
                this.monitoringGaps.push({
                    component: 'Performance Monitoring',
                    issue: 'No response time tracking',
                    severity: 'HIGH',
                    impact: 'Cannot detect performance degradation'
                });
            }
        }
        
        // Check for memory monitoring
        const hasMemoryMonitoring = fs.existsSync(appPath) && 
            fs.readFileSync(appPath, 'utf8').includes('memory') || 
            fs.readFileSync(appPath, 'utf8').includes('heap');
        
        if (!hasMemoryMonitoring) {
            this.monitoringGaps.push({
                component: 'Memory Monitoring',
                issue: 'No memory usage monitoring',
                severity: 'HIGH',
                impact: 'Memory leaks will go undetected'
            });
        }
        
        // Check for CPU monitoring
        const hasCPUMonitoring = fs.existsSync(appPath) && 
            fs.readFileSync(appPath, 'utf8').includes('cpu') || 
            fs.readFileSync(appPath, 'utf8').includes('process');
        
        if (!hasCPUMonitoring) {
            this.monitoringGaps.push({
                component: 'CPU Monitoring',
                issue: 'No CPU usage monitoring',
                severity: 'MEDIUM',
                impact: 'CPU spikes will go undetected'
            });
        }
        
        console.log(`   ✅ Performance monitoring review complete`);
    }

    /**
     * Review request logging
     */
    async reviewRequestLogging() {
        console.log('🔍 Reviewing request logging...');
        
        // Check for request logging middleware
        const appPath = path.join(__dirname, '../app.js');
        if (fs.existsSync(appPath)) {
            const content = fs.readFileSync(appPath, 'utf8');
            
            const hasRequestLogging = content.includes('morgan') || content.includes('req.log') || content.includes('request-logger');
            if (!hasRequestLogging) {
                this.loggingIssues.push({
                    component: 'Request Logging',
                    issue: 'No request logging middleware',
                    severity: 'MEDIUM',
                    impact: 'Cannot track API usage patterns'
                });
            }
            
            // Check for request ID tracking
            const hasRequestIdTracking = content.includes('requestId') || content.includes('correlationId') || content.includes('traceId');
            if (!hasRequestIdTracking) {
                this.loggingIssues.push({
                    component: 'Request Tracking',
                    issue: 'No request ID tracking',
                    severity: 'MEDIUM',
                    impact: 'Cannot trace requests across services'
                });
            }
        }
        
        console.log(`   ✅ Request logging review complete`);
    }

    /**
     * Review alerting system
     */
    async reviewAlertingSystem() {
        console.log('🔍 Reviewing alerting system...');
        
        // Check for alerting integration
        const appPath = path.join(__dirname, '../app.js');
        if (fs.existsSync(appPath)) {
            const content = fs.readFileSync(appPath, 'utf8');
            
            const hasAlerting = content.includes('alert') || content.includes('notify') || content.includes('pagerduty') || content.includes('slack');
            if (!hasAlerting) {
                this.alertingGaps.push({
                    component: 'Alerting Integration',
                    issue: 'No alerting system integration',
                    severity: 'HIGH',
                    impact: 'Critical issues will not trigger alerts'
                });
            }
        }
        
        // Check for health check alerts
        const hasHealthAlerts = fs.existsSync(appPath) && 
            fs.readFileSync(appPath, 'utf8').includes('/health') &&
            fs.readFileSync(appPath, 'utf8').includes('alert');
        
        if (!hasHealthAlerts) {
            this.alertingGaps.push({
                component: 'Health Alerting',
                issue: 'No health check failure alerts',
                severity: 'HIGH',
                impact: 'Service degradation will go unnoticed'
            });
        }
        
        // Check for error rate alerting
        const hasErrorRateAlerts = false; // Would need to check monitoring service config
        if (!hasErrorRateAlerts) {
            this.alertingGaps.push({
                component: 'Error Rate Alerting',
                issue: 'No error rate threshold alerts',
                severity: 'HIGH',
                impact: 'Error spikes will not trigger alerts'
            });
        }
        
        console.log(`   ✅ Alerting system review complete`);
    }

    /**
     * Review business metrics monitoring
     */
    async reviewBusinessMetrics() {
        console.log('🔍 Reviewing business metrics monitoring...');
        
        // Check for business metrics tracking
        const controllersDir = path.join(__dirname, '../controllers');
        const controllerFiles = fs.readdirSync(controllersDir).filter(f => f.endsWith('.js'));
        
        let hasBusinessMetrics = false;
        let hasOrderMetrics = false;
        let hasUserMetrics = false;
        
        for (const file of controllerFiles) {
            const filePath = path.join(controllersDir, file);
            const content = fs.readFileSync(filePath, 'utf8');
            
            if (content.includes('metrics') || content.includes('stats') || content.includes('analytics')) {
                hasBusinessMetrics = true;
            }
            
            if (file.includes('order') && (content.includes('metrics') || content.includes('stats'))) {
                hasOrderMetrics = true;
            }
            
            if (file.includes('user') && (content.includes('metrics') || content.includes('stats'))) {
                hasUserMetrics = true;
            }
        }
        
        if (!hasBusinessMetrics) {
            this.monitoringGaps.push({
                component: 'Business Metrics',
                issue: 'No business metrics tracking',
                severity: 'MEDIUM',
                impact: 'Cannot monitor business KPIs'
            });
        }
        
        if (!hasOrderMetrics) {
            this.monitoringGaps.push({
                component: 'Order Metrics',
                issue: 'No order metrics tracking',
                severity: 'MEDIUM',
                impact: 'Cannot monitor order volume and revenue'
            });
        }
        
        if (!hasUserMetrics) {
            this.monitoringGaps.push({
                component: 'User Metrics',
                issue: 'No user metrics tracking',
                severity: 'MEDIUM',
                impact: 'Cannot monitor user activity and engagement'
            });
        }
        
        console.log(`   ✅ Business metrics review complete`);
    }

    /**
     * Review security monitoring
     */
    async reviewSecurityMonitoring() {
        console.log('🔍 Reviewing security monitoring...');
        
        // Check for security event logging
        const controllersDir = path.join(__dirname, '../controllers');
        const controllerFiles = fs.readdirSync(controllersDir).filter(f => f.endsWith('.js'));
        
        let hasSecurityLogging = false;
        let hasAuthLogging = false;
        
        for (const file of controllerFiles) {
            const filePath = path.join(controllersDir, file);
            const content = fs.readFileSync(filePath, 'utf8');
            
            if (content.includes('security') || content.includes('audit') || content.includes('auth.log')) {
                hasSecurityLogging = true;
            }
            
            if (content.includes('login') || content.includes('auth') || content.includes('token')) {
                hasAuthLogging = true;
            }
        }
        
        if (!hasSecurityLogging) {
            this.monitoringGaps.push({
                component: 'Security Monitoring',
                issue: 'No security event logging',
                severity: 'HIGH',
                impact: 'Security incidents will go undetected'
            });
        }
        
        if (!hasAuthLogging) {
            this.monitoringGaps.push({
                component: 'Authentication Monitoring',
                issue: 'No authentication event logging',
                severity: 'HIGH',
                impact: 'Cannot track authentication attempts'
            });
        }
        
        // Check for rate limiting monitoring
        const appPath = path.join(__dirname, '../app.js');
        if (fs.existsSync(appPath)) {
            const content = fs.readFileSync(appPath, 'utf8');
            
            const hasRateLimitMonitoring = content.includes('rate-limit') && content.includes('log');
            if (!hasRateLimitMonitoring) {
                this.monitoringGaps.push({
                    component: 'Rate Limit Monitoring',
                    issue: 'No rate limiting event monitoring',
                    severity: 'MEDIUM',
                    impact: 'Cannot detect DDoS attempts'
                });
            }
        }
        
        console.log(`   ✅ Security monitoring review complete`);
    }

    /**
     * Review external monitoring integrations
     */
    async reviewExternalMonitoring() {
        console.log('🔍 Reviewing external monitoring integrations...');
        
        // Check for APM integration
        const packageJsonPath = path.join(__dirname, '../package.json');
        if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
            
            const apmTools = ['newrelic', 'datadog', 'appdynamics', 'dynatrace', 'elastic-apm'];
            const hasAPM = apmTools.some(tool => dependencies[tool]);
            
            if (!hasAPM) {
                this.monitoringGaps.push({
                    component: 'APM Integration',
                    issue: 'No Application Performance Monitoring tool',
                    severity: 'HIGH',
                    impact: 'Limited visibility into application performance'
                });
            }
            
            const loggingTools = ['winston', 'bunyan', 'pino'];
            const hasStructuredLogger = loggingTools.some(tool => dependencies[tool]);
            
            if (!hasStructuredLogger) {
                this.monitoringGaps.push({
                    component: 'Structured Logging',
                    issue: 'No structured logging library',
                    severity: 'MEDIUM',
                    impact: 'Poor log management and analysis'
                });
            }
        }
        
        console.log(`   ✅ External monitoring integrations review complete`);
    }

    /**
     * Generate monitoring and alerting report
     */
    generateReport() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 MONITORING & ALERTING REVIEW REPORT');
        console.log('='.repeat(80));
        
        // Group by severity
        const criticalGaps = this.monitoringGaps.filter(g => g.severity === 'CRITICAL');
        const highGaps = this.monitoringGaps.filter(g => g.severity === 'HIGH');
        const mediumGaps = this.monitoringGaps.filter(g => g.severity === 'MEDIUM');
        
        const criticalAlerts = this.alertingGaps.filter(g => g.severity === 'CRITICAL');
        const highAlerts = this.alertingGaps.filter(g => g.severity === 'HIGH');
        const mediumAlerts = this.alertingGaps.filter(g => g.severity === 'MEDIUM');
        
        console.log(`\n🚨 CRITICAL MONITORING GAPS (${criticalGaps.length}):`);
        criticalGaps.forEach((gap, index) => {
            console.log(`   ${index + 1}. 🔴 ${gap.component}:`);
            console.log(`      Issue: ${gap.issue}`);
            console.log(`      Impact: ${gap.impact}`);
        });
        
        console.log(`\n⚠️  HIGH MONITORING GAPS (${highGaps.length}):`);
        highGaps.forEach((gap, index) => {
            console.log(`   ${index + 1}. 🟡 ${gap.component}:`);
            console.log(`      Issue: ${gap.issue}`);
            console.log(`      Impact: ${gap.impact}`);
        });
        
        console.log(`\n💡 MEDIUM MONITORING GAPS (${mediumGaps.length}):`);
        mediumGaps.forEach((gap, index) => {
            console.log(`   ${index + 1}. 🟠 ${gap.component}:`);
            console.log(`      Issue: ${gap.issue}`);
            console.log(`      Impact: ${gap.impact}`);
        });
        
        console.log(`\n🚨 CRITICAL ALERTING GAPS (${criticalAlerts.length}):`);
        criticalAlerts.forEach((gap, index) => {
            console.log(`   ${index + 1}. 🔴 ${gap.component}:`);
            console.log(`      Issue: ${gap.issue}`);
            console.log(`      Impact: ${gap.impact}`);
        });
        
        console.log(`\n⚠️  HIGH ALERTING GAPS (${highAlerts.length}):`);
        highAlerts.forEach((gap, index) => {
            console.log(`   ${index + 1}. 🟡 ${gap.component}:`);
            console.log(`      Issue: ${gap.issue}`);
            console.log(`      Impact: ${gap.impact}`);
        });
        
        console.log(`\n💡 MEDIUM ALERTING GAPS (${mediumAlerts.length}):`);
        mediumAlerts.forEach((gap, index) => {
            console.log(`   ${index + 1}. 🟠 ${gap.component}:`);
            console.log(`      Issue: ${gap.issue}`);
            console.log(`      Impact: ${gap.impact}`);
        });
        
        console.log(`\n📝 LOGGING ISSUES (${this.loggingIssues.length}):`);
        this.loggingIssues.forEach((issue, index) => {
            const icon = issue.severity === 'HIGH' ? '🟡' : '🟠';
            console.log(`   ${index + 1}. ${icon} ${issue.component}:`);
            console.log(`      Issue: ${issue.issue}`);
            console.log(`      Impact: ${issue.impact}`);
        });
        
        // Calculate monitoring score
        const criticalWeight = (criticalGaps.length + criticalAlerts.length) * 3;
        const highWeight = (highGaps.length + highAlerts.length) * 2;
        const mediumWeight = (mediumGaps.length + mediumAlerts.length) * 1;
        const loggingWeight = this.loggingIssues.length * 1;
        
        const totalWeight = criticalWeight + highWeight + mediumWeight + loggingWeight;
        const monitoringScore = Math.max(0, 10 - totalWeight);
        
        console.log(`\n🎯 MONITORING SCORE: ${monitoringScore.toFixed(1)}/10`);
        
        return {
            criticalMonitoringGaps: criticalGaps.length,
            highMonitoringGaps: highGaps.length,
            mediumMonitoringGaps: mediumGaps.length,
            criticalAlertingGaps: criticalAlerts.length,
            highAlertingGaps: highAlerts.length,
            mediumAlertingGaps: mediumAlerts.length,
            loggingIssues: this.loggingIssues.length,
            monitoringScore,
            isMonitoringReady: criticalGaps.length === 0 && criticalAlerts.length === 0 && highGaps.length <= 3
        };
    }

    /**
     * Run comprehensive monitoring and alerting review
     */
    async runMonitoringAlertingReview() {
        console.log('🔥 COMPREHENSIVE MONITORING & ALERTING REVIEW');
        console.log('='.repeat(50));
        
        await this.reviewErrorTracking();
        await this.reviewPerformanceMonitoring();
        await this.reviewRequestLogging();
        await this.reviewAlertingSystem();
        await this.reviewBusinessMetrics();
        await this.reviewSecurityMonitoring();
        await this.reviewExternalMonitoring();
        
        return this.generateReport();
    }
}

if (require.main === module) {
    const review = new MonitoringAlertingReview();
    review.runMonitoringAlertingReview()
        .then(results => {
            console.log(`\n🏁 Monitoring & Alerting Review Complete`);
            console.log(`   Monitoring Ready: ${results.isMonitoringReady ? '✅' : '❌'}`);
            process.exit(results.isMonitoringReady ? 0 : 1);
        })
        .catch(error => {
            console.error('❌ Monitoring & alerting review failed:', error);
            process.exit(1);
        });
}

module.exports = MonitoringAlertingReview;
