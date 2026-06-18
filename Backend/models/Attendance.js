const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Attendance = sequelize.define('Attendance', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    lessonId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'lessons',
        key: 'id'
      }
    },
    postgraduateId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'unknown',
      validate: {
        isIn: [['present', 'absent', 'unknown']]
      }
    },
    comment: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    markedById: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    }
  }, {
    tableName: 'attendance',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['lessonId', 'postgraduateId'] }
    ]
  });

  return Attendance;
};

