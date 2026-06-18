const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Publication', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' }
    },
    title: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    venue: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    doi: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    indexing: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'draft',
      validate: {
        isIn: [['draft', 'submitted', 'verified', 'rejected']]
      }
    }
  }, {
    tableName: 'publications',
    timestamps: true
  });
};
