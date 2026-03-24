const { controlPlaneSequelize } = require('../config/control_plane_db');

/**
 * Security Audit Logger
 * Logs authentication and security events for compliance and monitoring
 */
class AuditLogger {
    constructor() {
        this.logLevels = {
            LOW: 'LOW',
            MEDIUM: 'MEDIUM',
            HIGH: 'HIGH',
            CRITICAL: 'CRITICAL'
        };
    }

    /**
     * Log authentication events
     */
    async logAuthEvent(event) {
        try {
            const auditData = {
                userId: event.userId || null,
                email: event.email || null,
                action: event.action,
                entity: 'AUTH',
                entityId: event.userId || null,
                oldValue: null,
                newValue: null,
                severity: this.getSeverityForAction(event.action),
                ipAddress: event.ip || null,
                userAgent: event.userAgent || null,
                path: event.path || null,
                metadata: {
                    error: event.error || null,
                    role: event.role || null,
                    timestamp: new Date().toISOString()
                }
            };

            // Try to use control plane audit log, fallback to console
            try {
                const { AuditLog } = require('../../control_plane_models');
                await AuditLog.create({
                    userId: auditData.userId,
                    brandId: null, // Could be extracted from user if needed
                    userEmail: auditData.email,
                    userRole: auditData.metadata?.role,
                    actionType: auditData.action,
                    entityType: auditData.entity,
                    entityId: auditData.entityId,
                    ipAddress: auditData.ipAddress,
                    userAgent: auditData.userAgent,
                    severity: auditData.severity,
                    metadata: auditData.metadata
                });
            } catch (dbError) {
                // Fallback to console if database is unavailable
                console.log('🔐 AUDIT:', JSON.stringify(auditData));
            }
        } catch (error) {
            console.error('Failed to log auth event:', error);
        }
    }

    /**
     * Log security violations
     */
    async logSecurityViolation(event) {
        try {
            const auditData = {
                userId: event.userId || null,
                email: event.email || null,
                action: event.action,
                entity: 'SECURITY',
                entityId: event.entityId || null,
                oldValue: null,
                newValue: null,
                severity: event.severity || this.logLevels.HIGH,
                ipAddress: event.ip || null,
                userAgent: event.userAgent || null,
                path: event.path || null,
                metadata: {
                    violation: event.violation || null,
                    details: event.details || null,
                    timestamp: new Date().toISOString()
                }
            };

            try {
                const { AuditLog } = require('../../control_plane_models');
                await AuditLog.create({
                    userId: auditData.userId,
                    brandId: null, // Could be extracted from user if needed
                    userEmail: auditData.email,
                    userRole: auditData.metadata?.role,
                    actionType: auditData.action,
                    entityType: auditData.entity,
                    entityId: auditData.entityId,
                    ipAddress: auditData.ipAddress,
                    userAgent: auditData.userAgent,
                    severity: auditData.severity,
                    metadata: auditData.metadata
                });
            } catch (dbError) {
                console.log('🚨 SECURITY VIOLATION:', JSON.stringify(auditData));
            }
        } catch (error) {
            console.error('Failed to log security violation:', error);
        }
    }

    /**
     * Log data access events
     */
    async logDataAccess(event) {
        try {
            const auditData = {
                userId: event.userId || null,
                email: event.email || null,
                action: event.action,
                entity: event.entity || 'DATA',
                entityId: event.entityId || null,
                oldValue: null,
                newValue: null,
                severity: this.logLevels.LOW,
                ipAddress: event.ip || null,
                userAgent: event.userAgent || null,
                path: event.path || null,
                metadata: {
                    resource: event.resource || null,
                    operation: event.operation || null,
                    timestamp: new Date().toISOString()
                }
            };

            try {
                const { AuditLog } = require('../../control_plane_models');
                await AuditLog.create({
                    userId: auditData.userId,
                    brandId: null, // Could be extracted from user if needed
                    userEmail: auditData.email,
                    userRole: auditData.metadata?.role,
                    actionType: auditData.action,
                    entityType: auditData.entity,
                    entityId: auditData.entityId,
                    ipAddress: auditData.ipAddress,
                    userAgent: auditData.userAgent,
                    severity: auditData.severity,
                    metadata: auditData.metadata
                });
            } catch (dbError) {
                // Fallback to console if database is unavailable
                console.log('� AUDIT:', JSON.stringify(auditData));
            }
        } catch (error) {
            console.error('Failed to log data access:', error);
        }
    }

    /**
     * Determine severity level for actions
     */
    getSeverityForAction(action) {
        const severityMap = {
            'TOKEN_VERIFIED': this.logLevels.LOW,
            'TOKEN_VERIFICATION_FAILED': this.logLevels.MEDIUM,
            'LOGIN_SUCCESS': this.logLevels.LOW,
            'LOGIN_FAILED': this.logLevels.MEDIUM,
            'LOGOUT': this.logLevels.LOW,
            'PASSWORD_CHANGE': this.logLevels.MEDIUM,
            'ACCOUNT_LOCKED': this.logLevels.HIGH,
            'PRIVILEGE_ESCALATION': this.logLevels.CRITICAL,
            'TENANT_ISOLATION_BREACH': this.logLevels.CRITICAL,
            'UNAUTHORIZED_ACCESS': this.logLevels.HIGH
        };

        return severityMap[action] || this.logLevels.MEDIUM;
    }
}

// Export singleton instance
const auditLogger = new AuditLogger();

// Convenience exports
// NOTE: Audit logging is fire-and-forget (non-blocking) to prevent
// audit logging delays from affecting API response times
module.exports = {
    logAuthEvent: (event) => {
        // Return promise so callers can chain .catch() if needed
        return auditLogger.logAuthEvent(event);
    },
    logSecurityViolation: (event) => {
        return auditLogger.logSecurityViolation(event);
    },
    logDataAccess: (event) => {
        return auditLogger.logDataAccess(event);
    },
    auditLogger
};
