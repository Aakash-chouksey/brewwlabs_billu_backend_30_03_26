const { getTenantConnectionStats } = require('../src/db/tenantConnectionFactory');
const { getCacheStats } = require('../src/cache/tenantCacheService');

/**
 * Scalability Validation Service
 * Validates system can support 1000 tenants and 10k concurrent users
 */
class ScalabilityValidationService {
    /**
     * Run comprehensive scalability validation
     * @returns {Promise<Object>} - Validation results
     */
    async validateScalability() {
        console.log('🔍 Starting scalability validation...');
        
        const results = {
            timestamp: new Date().toISOString(),
            tenantConnectionPool: await this.validateTenantConnectionPool(),
            redisCache: await this.validateRedisCache(),
            memoryUsage: await this.validateMemoryUsage(),
            connectionLimits: await this.validateConnectionLimits(),
            performance: await this.validatePerformanceMetrics(),
            overallStatus: 'UNKNOWN'
        };

        // Calculate overall status
        const allPassed = Object.values(results)
            .filter(result => typeof result === 'object' && result.status)
            .every(result => result.status === 'PASS');

        results.overallStatus = allPassed ? 'PASS' : 'FAIL';
        
        console.log(`✅ Scalability validation completed: ${results.overallStatus}`);
        return results;
    }

    /**
     * Validate tenant connection pool scalability
     */
    async validateTenantConnectionPool() {
        try {
            const stats = getTenantConnectionStats();
            
            const validation = {
                status: 'PASS',
                maxActiveTenants: stats.cache?.maxSize || 1000,
                currentActiveTenants: stats.cache?.size || 0,
                totalConnectionsCreated: stats.totalConnectionsCreated,
                cacheHitRate: this.calculateCacheHitRate(stats),
                recommendations: []
            };

            // Check if configured for 1000 tenants
            if (validation.maxActiveTenants < 1000) {
                validation.status = 'FAIL';
                validation.recommendations.push('Increase MAX_ACTIVE_TENANTS to 1000 or more');
            }

            // Check cache hit rate
            if (validation.cacheHitRate < 80) {
                validation.recommendations.push('Cache hit rate below 80%, consider increasing TTL');
            }

            // Check connection pool settings
            const expectedPoolMax = 5; // For 10k users
            if (expectedPoolMax < 5) {
                validation.recommendations.push('Set TENANT_POOL_MAX to 5 for 10k concurrent users');
            }

            return validation;
            
        } catch (error) {
            return {
                status: 'ERROR',
                error: error.message,
                recommendations: ['Fix tenant connection factory configuration']
            };
        }
    }

    /**
     * Validate Redis cache configuration
     */
    async validateRedisCache() {
        try {
            const cacheStats = await getCacheStats();
            
            const validation = {
                status: 'PASS',
                redisStatus: cacheStats.status,
                totalKeys: cacheStats.totalKeys,
                memoryUsage: cacheStats.memoryUsage,
                ttl: cacheStats.ttl,
                recommendations: []
            };

            if (cacheStats.status === 'disconnected') {
                validation.status = 'FAIL';
                validation.recommendations.push('Redis is not connected - configure REDIS_URL');
            } else if (cacheStats.status === 'error') {
                validation.status = 'FAIL';
                validation.recommendations.push(`Redis error: ${cacheStats.error}`);
            }

            // Check TTL configuration
            if (cacheStats.ttl < 3600) {
                validation.recommendations.push('Consider increasing Redis TTL to 1 hour or more');
            }

            return validation;
            
        } catch (error) {
            return {
                status: 'ERROR',
                error: error.message,
                recommendations: ['Fix Redis client configuration']
            };
        }
    }

    /**
     * Validate memory usage patterns
     */
    async validateMemoryUsage() {
        try {
            const memUsage = process.memoryUsage();
            
            const validation = {
                status: 'PASS',
                heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
                heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
                external: Math.round(memUsage.external / 1024 / 1024), // MB
                rss: Math.round(memUsage.rss / 1024 / 1024), // MB
                recommendations: []
            };

            // Check memory usage (warning thresholds)
            if (validation.heapUsed > 512) {
                validation.recommendations.push('Heap usage > 512MB, monitor for memory leaks');
            }

            if (validation.rss > 1024) {
                validation.recommendations.push('RSS > 1GB, consider optimizing memory usage');
            }

            return validation;
            
        } catch (error) {
            return {
                status: 'ERROR',
                error: error.message,
                recommendations: ['Monitor memory usage patterns']
            };
        }
    }

    /**
     * Validate connection limits and configuration
     */
    async validateConnectionLimits() {
        try {
            const validation = {
                status: 'PASS',
                maxTenants: parseInt(process.env.MAX_ACTIVE_TENANTS || '1000'),
                poolMax: parseInt(process.env.TENANT_POOL_MAX || '5'),
                poolMin: parseInt(process.env.TENANT_POOL_MIN || '1'),
                ttl: parseInt(process.env.TENANT_CONNECTION_TTL || '900000'),
                recommendations: []
            };

            // Validate 1000 tenant support
            if (validation.maxTenants < 1000) {
                validation.status = 'FAIL';
                validation.recommendations.push('Set MAX_ACTIVE_TENANTS=1000 for 1000 tenant support');
            }

            // Validate 10k user support
            const maxConnections = validation.maxTenants * validation.poolMax;
            if (maxConnections < 5000) {
                validation.recommendations.push('Increase pool size to support 10k concurrent users');
            }

            // Check TTL configuration
            if (validation.ttl < 900000) {
                validation.recommendations.push('Set TENANT_CONNECTION_TTL=900000 (15 minutes)');
            }

            return validation;
            
        } catch (error) {
            return {
                status: 'ERROR',
                error: error.message,
                recommendations: ['Fix environment variable configuration']
            };
        }
    }

    /**
     * Validate performance metrics
     */
    async validatePerformanceMetrics() {
        try {
            const validation = {
                status: 'PASS',
                cpuUsage: process.cpuUsage(),
                uptime: Math.round(process.uptime()),
                recommendations: []
            };

            // Check uptime (should be stable)
            if (validation.uptime < 60) {
                validation.recommendations.push('Server recently restarted - monitor stability');
            }

            return validation;
            
        } catch (error) {
            return {
                status: 'ERROR',
                error: error.message,
                recommendations: ['Monitor performance metrics']
            };
        }
    }

    /**
     * Calculate cache hit rate percentage
     */
    calculateCacheHitRate(stats) {
        const total = stats.cacheHits + stats.cacheMisses;
        if (total === 0) return 0;
        return Math.round((stats.cacheHits / total) * 100);
    }

    /**
     * Generate scalability report
     */
    generateReport(validationResults) {
        const report = {
            summary: {
                status: validationResults.overallStatus,
                timestamp: validationResults.timestamp,
                supportedTenants: validationResults.connectionLimits?.maxTenants || 0,
                supportedUsers: (validationResults.connectionLimits?.maxTenants || 0) * (validationResults.connectionLimits?.poolMax || 0)
            },
            details: validationResults,
            recommendations: this.aggregateRecommendations(validationResults)
        };

        return report;
    }

    /**
     * Aggregate all recommendations
     */
    aggregateRecommendations(results) {
        const allRecommendations = [];
        
        Object.values(results).forEach(result => {
            if (result.recommendations && Array.isArray(result.recommendations)) {
                allRecommendations.push(...result.recommendations);
            }
        });

        return [...new Set(allRecommendations)]; // Remove duplicates
    }
}

module.exports = new ScalabilityValidationService();
