const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const BillingConfig = sequelize.define('BillingConfig', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    businessId: {
        field: 'business_id',
            type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      field: 'business_id'
    },
    themeColor: {
        field: 'theme_color',
            type: DataTypes.STRING,
      defaultValue: '#000000'
    },
    paperSize: {
        field: 'paper_size',
            type: DataTypes.STRING,
      defaultValue: 'Thermal80mm'
    },
    footerText: {
        field: 'footer_text',
            type: DataTypes.STRING,
      defaultValue: 'Thank you for your business!'
    },
    lotteryMode: {
        field: 'lottery_mode',
            type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    showLogo: {
        field: 'show_logo',
            type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    showTax: {
        field: 'show_tax',
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
        field: 'service_charge_rate',
            type: DataTypes.DECIMAL(5, 4),
      defaultValue: 0.00,
      field: 'service_charge_rate'
    },
    serviceChargeInclusive: {
        field: 'service_charge_inclusive',
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
        freezeTableName: true,
    indexes: [
      {
        fields: ['business_id']
      }
    ]
  });

  return BillingConfig;
};
