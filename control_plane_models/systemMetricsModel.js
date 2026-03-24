const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const SystemMetrics = sequelize.define('SystemMetrics', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        metricName: {
            type: DataTypes.STRING,
            allowNull: false,
            field: 'metric_name',
            unique: true
        },
        metricValue: {
            type: DataTypes.JSONB,
            allowNull: false,
            field: 'metric_value'
        },
        lastUpdated: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
            field: 'last_updated'
        }
    }, {
        tableName: 'system_metrics',
        timestamps: false,
        underscored: true
    });

    return SystemMetrics;
};
