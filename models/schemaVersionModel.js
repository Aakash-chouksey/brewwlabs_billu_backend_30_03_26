const { DataTypes } = require('sequelize');

/**
 * SCHEMA VERSION MODEL
 * Tracks the current migration version for each tenant schema.
 * Enhanced for data-first architecture with full migration tracking.
 * 
 * REQUIRED TABLE STRUCTURE:
 * CREATE TABLE schema_versions (
 *   version INTEGER PRIMARY KEY,
 *   migration_name VARCHAR(255),
 *   description TEXT,
 *   checksum VARCHAR(64),
 *   applied_by VARCHAR(100),
 *   applied_at TIMESTAMP DEFAULT NOW()
 * )
 */
module.exports = (sequelize) => {
    const SchemaVersion = sequelize.define('SchemaVersion', {
        id: {
            type: DataTypes.UUID,
            primaryKey: true,
            defaultValue: DataTypes.UUIDV4,
            field: 'id'
        },
        businessId: {
            field: 'business_id',
            type: DataTypes.UUID,
            allowNull: true // Optional for system-level tracking
        },
        version: {
            type: DataTypes.INTEGER,
            unique: true,
            allowNull: false,
            field: 'version'
        },
        migrationName: {
            field: 'migration_name',
            type: DataTypes.STRING(255),
            allowNull: true
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        checksum: {
            type: DataTypes.STRING(64),
            allowNull: true
        },
        appliedBy: {
            field: 'applied_by',
            type: DataTypes.STRING(100),
            allowNull: true
        },
        appliedAt: {
            field: 'applied_at',
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
            allowNull: false
        }
    }, {
        tableName: 'schema_versions',
        timestamps: true,
        underscored: true,
        freezeTableName: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { fields: ['version'], unique: true },
            { fields: ['business_id'] },
            { fields: ['applied_at'] }
        ]
    });

    return SchemaVersion;
};
