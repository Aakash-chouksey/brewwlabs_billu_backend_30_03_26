const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const SystemMetrics = sequelize.define('SystemMetrics', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        metricName: {
            field: 'metric_name',
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        metricValue: {
            field: 'metric_value',
            type: DataTypes.JSONB,
            allowNull: false
        },
        lastUpdated: {
            field: 'last_updated',
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    }, {
        tableName: 'system_metrics',
        timestamps: false,
        underscored: true
    });

    return SystemMetrics;
};
