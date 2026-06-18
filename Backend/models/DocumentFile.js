const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('DocumentFile', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    documentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'documents', key: 'id' }
    },
    storedName: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    originalName: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    mimeType: {
      type: DataTypes.STRING(120),
      allowNull: true
    },
    size: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    uploadedById: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' }
    }
  }, {
    tableName: 'document_files',
    timestamps: true
  });
};
