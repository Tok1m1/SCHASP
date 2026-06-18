const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Supervision', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    postgraduateId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' }
    },
    supervisorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' }
    },
    startedAt: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    endedAt: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    supervisionKind: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'primary',
      validate: {
        isIn: [['primary', 'co_supervisor']]
      }
    }
  }, {
    tableName: 'supervisions',
    timestamps: true
  });
};
