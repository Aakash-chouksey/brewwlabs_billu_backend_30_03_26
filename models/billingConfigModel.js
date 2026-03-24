const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const BillingConfig = sequelize.define('BillingConfig', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    businessId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      field: 'business_id'
    },
    themeColor: {
      type: DataTypes.STRING,
      defaultValue: '#000000'
    },
    paperSize: {
      type: DataTypes.STRING,
      defaultValue: 'Thermal80mm'
    },
    footerText: {
      type: DataTypes.STRING,
      defaultValue: 'Thank you for your business!'
    },
    lotteryMode: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    showLogo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    showTax: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    taxRate: {
      type: DataTypes.DECIMAL(5, 4),
      defaultValue: 0.05,
      field: 'tax_rate'
    },
    taxInclusive: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'tax_inclusive'
    },
    headerText: {
      type: DataTypes.STRING,
      defaultValue: '',
      field: 'header_text'
    },
    businessAddress: {
      type: DataTypes.TEXT,
      defaultValue: '',
      field: 'business_address'
    },
    businessPhone: {
      type: DataTypes.STRING,
      defaultValue: '',
      field: 'business_phone'
    },
    businessEmail: {
      type: DataTypes.STRING,
      defaultValue: '',
      field: 'business_email'
    },
    serviceChargeRate: {
      type: DataTypes.DECIMAL(5, 4),
      defaultValue: 0.00,
      field: 'service_charge_rate'
    },
    serviceChargeInclusive: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'service_charge_inclusive'
    },
    logoUrl: {
      type: DataTypes.STRING,
      defaultValue: '',
      field: 'logo_url'
    }
  }, {
    tableName: 'billing_configs',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['business_id']
      }
    ]
  });

  return BillingConfig;
};
