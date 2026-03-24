const { DataTypes } = require('sequelize');

const createPlaceholderModel = (sequelize) => {
    // Check if we have a real database connection or a dummy one
    const isDummyConnection = !sequelize.define || typeof sequelize.define !== 'function';
    
    if (isDummyConnection) {
        // Return a completely mock model that doesn't touch the database
        return {
            count: async () => 0,
            findAll: async () => [],
            findByPk: async () => null,
            findOne: async () => null,
            create: async () => null,
            update: async () => [0],
            destroy: async () => 0,
            sum: async () => 0,
            findAndCountAll: async () => ({ count: 0, rows: [] }),
            // Mock instance methods
            async save() { return this; },
            async update() { return this; },
            async destroy() { return this; }
        };
    }
    
    // If we have a real sequelize connection, create a proper model
    const PlaceholderModel = sequelize.define('Placeholder', {
        id: {
            type: require('sequelize').DataTypes.UUID,
            defaultValue: require('sequelize').DataTypes.UUIDV4,
            primaryKey: true
        },
        name: {
            type: require('sequelize').DataTypes.STRING,
            allowNull: false
        }
    }, {
        tableName: 'placeholders',
        timestamps: true
    });

    // Override methods to return safe defaults
    PlaceholderModel.count = async () => 0;
    PlaceholderModel.findAll = async () => [];
    PlaceholderModel.findByPk = async () => null;
    PlaceholderModel.findOne = async () => null;
    PlaceholderModel.create = async () => null;
    PlaceholderModel.update = async () => [0];
    PlaceholderModel.destroy = async () => 0;
    PlaceholderModel.sum = async () => 0;
    PlaceholderModel.findAndCountAll = async () => ({ count: 0, rows: [] });

    return PlaceholderModel;
};

module.exports = createPlaceholderModel;
