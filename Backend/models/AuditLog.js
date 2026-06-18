const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('AuditLog', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    actorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' }
    },
    action: {
      type: DataTypes.STRING(80),
      allowNull: false
    },
    entityType: {
      type: DataTypes.STRING(80),
      allowNull: false
    },
    entityId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    details: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'audit_logs',
    timestamps: true,
    updatedAt: false
  });
};
