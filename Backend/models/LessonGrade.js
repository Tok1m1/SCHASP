const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('LessonGrade', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    lessonId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'lessons', key: 'id' }
    },
    postgraduateId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' }
    },
    grade: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    markedById: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' }
    }
  }, {
    tableName: 'lesson_grades',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['lessonId', 'postgraduateId'] }
    ]
  });
};

