const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('DissertationTopic', {
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
      type: DataTypes.TEXT,
      allowNull: false
    },
    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'draft',
      validate: {
        isIn: [['draft', 'submitted', 'approved', 'rejected', 'archived']]
      }
    },
    rejectReason: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'dissertation_topics',
    timestamps: true
  });
};
