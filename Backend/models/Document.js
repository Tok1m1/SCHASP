const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('AcademicDocument', {
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
    documentType: {
      type: DataTypes.STRING(80),
      allowNull: false
    },
    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'draft',
      validate: {
        isIn: [['draft', 'on_review', 'approved', 'rejected']]
      }
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'documents',
    timestamps: true
  });
};
