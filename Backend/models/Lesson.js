const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Lesson', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    groupId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'groups', key: 'id' }
    },
    teacherId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' }
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    time: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    subject: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    auditorium: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'normal',
      validate: {
        isIn: [['normal', 'cancelled', 'substituted']]
      }
    },
    substituteTeacherId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' }
    }
  }, {
    tableName: 'lessons',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['groupId', 'teacherId', 'date', 'time', 'subject'] }
    ]
  });
};

