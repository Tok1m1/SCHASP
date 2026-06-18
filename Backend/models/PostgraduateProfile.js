const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('PostgraduateProfile', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: { model: 'users', key: 'id' }
    },
    enrollmentYear: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    department: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    specialtyCode: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    studyForm: {
      type: DataTypes.STRING(30),
      allowNull: true
    },
    programId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'programs', key: 'id' }
    }
  }, {
    tableName: 'postgraduate_profiles',
    timestamps: true
  });
};
