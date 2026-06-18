const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Milestone', {
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
    milestoneType: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    dueDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'pending',
      validate: {
        isIn: [['pending', 'in_progress', 'done', 'skipped']]
      }
    },
    supervisorComment: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'milestones',
    timestamps: true
  });
};
