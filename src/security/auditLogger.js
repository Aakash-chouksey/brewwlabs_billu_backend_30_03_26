const { AuditService } = require('../../control_plane_models/auditLogModel');

/**
 * Audit Logger for security events
 */
class AuditLogger {
  static async logSecurityEvent(eventData) {
    try {
      const { userId, action, entityType, entityId, severity, details, ipAddress, userAgent } = eventData;
      
      await AuditService.logEvent({
        userId,
        actionType: action,
        entityType,
        entityId,
        severityLevel: severity || 'MEDIUM',
        metadata: details || {},
        ipAddress,
        userAgent
      });
      
      console.log(`🔒 Audit log: ${action} - ${severity} - ${userId || 'anonymous'}`);
    } catch (error) {
      console.error('❌ Failed to log audit event:', error.message);
    }
  }
  
  static async logRateLimitViolation(ipAddress, userAgent, details = {}) {
    return this.logSecurityEvent({
      userId: null,
      action: 'RATE_LIMIT_VIOLATION',
      entityType: 'IP',
      entityId: null,
      severity: 'MEDIUM',
      details,
      ipAddress,
      userAgent
    });
  }
}

module.exports = AuditLogger;
