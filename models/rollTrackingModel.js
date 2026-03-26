const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const RollTracking = sequelize.define('RollTracking', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      businessId: {
            type: DataTypes.UUID,
        allowNull: false,
        field: 'business_id'
      },
      outletId: {
            type: DataTypes.UUID,
          allowNull: false,
          field: 'outlet_id'
      },
      rollName: {
          field: 'roll_name',
            type: DataTypes.STRING,
        defaultValue: 'Thermal Roll',
        field: 'roll_name'
      },
      status: {
        type: DataTypes.STRING,
        defaultValue: 'active'
      },
      length: {
        type: DataTypes.FLOAT, // Total length in meters
        defaultValue: 50.0 
      },
      printedLength: {
          field: 'printed_length',
            type: DataTypes.FLOAT, // Used length in meters
        defaultValue: 0.0,
        field: 'printed_length'
      },
      startedAt: {
          field: 'started_at',
            type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'started_at'
      },
      endedAt: {
            type: DataTypes.DATE,
        field: 'ended_at'
      },
      replacedBy: {
            type: DataTypes.UUID, // userId who replaced it
          field: 'replaced_by'
      }
    }, {
      tableName: 'roll_trackings',
      timestamps: true,
      underscored: true,
        freezeTableName: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    });

    return RollTracking;
};
