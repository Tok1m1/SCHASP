const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('IndividualPlan', {
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
    academicYear: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'draft',
      validate: {
        isIn: [['draft', 'submitted', 'approved', 'rejected', 'archived']]
      }
    }
  }, {
    tableName: 'individual_plans',
    timestamps: true
  });
};
