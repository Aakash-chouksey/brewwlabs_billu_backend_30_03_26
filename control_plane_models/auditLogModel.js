const { DataTypes } = require('sequelize');
const { controlPlaneSequelize } = require('../config/control_plane_db');

/**
 * Audit Log Model for Security and Compliance
 * Tracks all critical security events across the system
 */
const AuditLog = controlPlaneSequelize && controlPlaneSequelize.define ? 
  controlPlaneSequelize.define('AuditLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
            type: DataTypes.UUID,
      allowNull: true,
      field: 'user_id',
      comment: 'User who performed the action'
    },
    brandId: {
            type: DataTypes.UUID,
      allowNull: true,
      field: 'brand_id',
      comment: 'Brand/tenant context for the action'
    },
    userEmail: {
            type: DataTypes.STRING(255),
      allowNull: true,
      field: 'user_email',
      comment: 'User email for identification'
    },
    userRole: {
            type: DataTypes.STRING(50),
      allowNull: true,
      field: 'user_role',
      comment: 'User role at time of action'
    },
    actionType: {
            type: DataTypes.STRING(100),
      allowNull: false,
      field: 'action_type',
      comment: 'Type of action performed'
    },
    entityType: {
            type: DataTypes.STRING(100),
      allowNull: true,
      field: 'entity_type',
      comment: 'Entity type that was acted upon (user, order, product, etc.)'
    },
    entityId: {
            type: DataTypes.UUID,
      allowNull: true,
      field: 'entity_id',
      comment: 'ID of the entity that was acted upon'
    },
    actionDescription: {
            type: DataTypes.TEXT,
      allowNull: true,
      field: 'action_description',
      comment: 'Description of the action performed'
    },
    ipAddress: {
            type: DataTypes.STRING,
      allowNull: true,
      field: 'ip_address',
      comment: 'IP address from which the action was performed'
    },
    userAgent: {
            type: DataTypes.TEXT,
      allowNull: true,
      field: 'user_agent',
      comment: 'Browser/client identifier'
    },
    requestMethod: {
            type: DataTypes.STRING(10),
      allowNull: true,
      field: 'request_method',
      comment: 'HTTP method used'
    },
    requestPath: {
            type: DataTypes.STRING(500),
      allowNull: true,
      field: 'request_path',
      comment: 'Request path'
    },
    tenantId: {
            type: DataTypes.UUID,
      allowNull: true,
      field: 'tenant_id',
      comment: 'Tenant context for the action'
    },
    brandId: {
            type: DataTypes.UUID,
      allowNull: true,
      field: 'brand_id',
      comment: 'Brand context for the action'
    },
    severityLevel: {
            type: DataTypes.STRING,
      defaultValue: 'LOW',
      field: 'severity_level',
      comment: 'Security severity level'
    },
    outcome: {
      type: DataTypes.STRING,
      defaultValue: 'SUCCESS',
      comment: 'Result of the action'
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: 'Additional metadata in JSON format'
    },
    oldValues: {
            type: DataTypes.JSONB,
      allowNull: true,
      field: 'old_values',
      comment: 'Previous entity values before update'
    },
    newValues: {
            type: DataTypes.JSONB,
      allowNull: true,
      field: 'new_values',
      comment: 'New entity values after update'
    },
    createdAt: {
            type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'created_at',
      comment: 'When the action occurred'
    }
  }, {
    tableName: 'audit_logs',
        underscored: true,
    timestamps: true,
    updatedAt: false,
    indexes: [
      {
        fields: ['user_id'],
        name: 'audit_logs_user_id_idx'
      },
      {
        fields: ['brand_id'],
        name: 'audit_logs_brand_id_idx'
      },
      {
        fields: ['action_type'],
        name: 'audit_logs_action_type_idx'
      },
      {
        fields: ['created_at'],
        name: 'audit_logs_created_at_idx'
      }
    ]
  }) : null;

/**
 * Audit Service for logging security events
 */
class AuditService {
  /**
   * Log a security event
   */
  static async logEvent(data) {
    const {
      userId,
      userEmail,
      userRole,
      actionType,
      entityType,
      entityId,
      actionDescription,
      details = {},
      ipAddress,
      userAgent,
      requestMethod,
      requestPath,
      tenantId,
      brandId,
      severityLevel = 'LOW',
      outcome = 'SUCCESS',
      metadata = {},
      oldValues,
      newValues
    } = data;

    try {
      if (AuditLog && controlPlaneSequelize) {
        await AuditLog.create({
          userId,
          userEmail,
          userRole,
          actionType,
          entityType,
          entityId,
          actionDescription,
          metadata: { ...details, ...metadata },
          ipAddress,
          userAgent,
          requestMethod,
          requestPath,
          tenantId: brandId || tenantId,
          brandId: brandId,
          severityLevel,
          outcome,
          oldValues,
          newValues
        });
      }
    } catch (error) {
      console.error('Failed to log audit event:', error);
    }
  }

  /**
   * Log authentication events
   */
  static async logAuth(req, actionType, userId = null, brandId = null, details = {}) {
    await this.logEvent({
      userId: userId || req.auth?.id,
      userEmail: req.auth?.email,
      userRole: req.auth?.role,
      actionType,
      entityType: 'user',
      entityId: userId || req.auth?.id,
      actionDescription: `${actionType} event for user ${req.auth?.email}`,
      metadata: {
        ...details,
        email: req.auth?.email,
        role: req.auth?.role,
        panelType: req.auth?.panelType
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestMethod: req.method,
      requestPath: req.path,
      brandId: brandId || req.auth?.businessId,
      severityLevel: actionType === 'LOGIN' ? 'MEDIUM' : 'LOW'
    });
  }

  /**
   * Log tenant switching events
   */
  static async logTenantSwitch(req, fromBrandId, toBrandId) {
    await this.logEvent({
      userId: req.auth?.id,
      userEmail: req.auth?.email,
      userRole: req.auth?.role,
      actionType: 'TENANT_SWITCH',
      entityType: 'brand',
      entityId: toBrandId,
      actionDescription: `Tenant switch from ${fromBrandId} to ${toBrandId}`,
      metadata: {
        fromBrandId,
        toBrandId,
        userEmail: req.auth?.email
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestMethod: req.method,
      requestPath: req.path,
      brandId: toBrandId,
      severityLevel: 'MEDIUM'
    });
  }

  /**
   * Log admin actions
   */
  static async logAdminAction(req, action, entity, entityId, details = {}) {
    await this.logEvent({
      userId: req.auth?.id,
      userEmail: req.auth?.email,
      userRole: req.auth?.role,
      actionType: 'ADMIN_ACTION',
      entityType: entity,
      entityId,
      actionDescription: `Admin action: ${action} on ${entity}`,
      metadata: {
        adminAction: action,
        ...details,
        userEmail: req.auth?.email
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestMethod: req.method,
      requestPath: req.path,
      brandId: req.auth?.businessId,
      severityLevel: 'HIGH'
    });
  }

  /**
   * Log security violations
   */
  static async logSecurityViolation(req, violation, details = {}) {
    await this.logEvent({
      userId: req.auth?.id,
      userEmail: req.auth?.email,
      userRole: req.auth?.role,
      actionType: 'SECURITY_VIOLATION',
      entityType: 'security',
      entityId: req.auth?.id,
      actionDescription: `Security violation: ${violation}`,
      metadata: {
        violation,
        ...details,
        userEmail: req.auth?.email,
        userRole: req.auth?.role
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestMethod: req.method,
      requestPath: req.path,
      brandId: req.auth?.businessId,
      severityLevel: 'CRITICAL',
      outcome: 'FAILURE'
    });
  }

  /**
   * Log data access events
   */
  static async logDataAccess(req, action, entity, details = {}) {
    await this.logEvent({
      userId: req.auth?.id,
      userEmail: req.auth?.email,
      userRole: req.auth?.role,
      actionType: 'DATA_ACCESS',
      entityType: entity,
      entityId: details.entityId,
      actionDescription: `Data access: ${action} on ${entity}`,
      metadata: {
        action,
        entity,
        ...details,
        userEmail: req.auth?.email
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestMethod: req.method,
      requestPath: req.path,
      brandId: req.auth?.businessId,
      severityLevel: 'LOW'
    });
  }
}

module.exports = {
  AuditLog,
  AuditService
};
