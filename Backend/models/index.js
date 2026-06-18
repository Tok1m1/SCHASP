const { Sequelize } = require('sequelize');
const dbConfig = require('../config/database');
const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    logging: dbConfig.logging,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

const Group = require('./Group')(sequelize);
const User = require('./User')(sequelize);
const Lesson = require('./Lesson')(sequelize);
const LessonGrade = require('./LessonGrade')(sequelize);
const Message = require('./Message')(sequelize);
const Program = require('./Program')(sequelize);
const PostgraduateProfile = require('./PostgraduateProfile')(sequelize);
const Attendance = require('./Attendance')(sequelize);
const Supervision = require('./Supervision')(sequelize);
const DissertationTopic = require('./DissertationTopic')(sequelize);
const IndividualPlan = require('./IndividualPlan')(sequelize);
const PlanItem = require('./PlanItem')(sequelize);
const Milestone = require('./Milestone')(sequelize);
const Publication = require('./Publication')(sequelize);
const Attestation = require('./Attestation')(sequelize);
const AcademicDocument = require('./Document')(sequelize);
const DocumentFile = require('./DocumentFile')(sequelize);
const Notification = require('./Notification')(sequelize);
const DissertationTopicHistory = require('./DissertationTopicHistory')(sequelize);
const AuditLog = require('./AuditLog')(sequelize);

User.hasMany(Message, { foreignKey: 'senderId', as: 'sentMessages' });
User.hasMany(Message, { foreignKey: 'recipientId', as: 'receivedMessages' });
Message.belongsTo(User, { foreignKey: 'senderId', as: 'sender' });
Message.belongsTo(User, { foreignKey: 'recipientId', as: 'recipient' });

Group.hasMany(User, { foreignKey: 'groupId', as: 'members' });
User.belongsTo(Group, { foreignKey: 'groupId', as: 'group' });

Group.hasMany(Lesson, { foreignKey: 'groupId', as: 'lessons' });
Lesson.belongsTo(Group, { foreignKey: 'groupId', as: 'group' });
Lesson.belongsTo(User, { foreignKey: 'teacherId', as: 'teacher' });
User.hasMany(Lesson, { foreignKey: 'teacherId', as: 'teachingLessons' });
Lesson.belongsTo(User, { foreignKey: 'substituteTeacherId', as: 'substituteTeacher' });
User.hasMany(Lesson, { foreignKey: 'substituteTeacherId', as: 'substituteLessons' });

Lesson.hasMany(Attendance, { foreignKey: 'lessonId', as: 'attendance' });
Attendance.belongsTo(Lesson, { foreignKey: 'lessonId', as: 'lesson' });
User.hasMany(Attendance, { foreignKey: 'postgraduateId', as: 'attendanceMarks' });
Attendance.belongsTo(User, { foreignKey: 'postgraduateId', as: 'postgraduate' });
Attendance.belongsTo(User, { foreignKey: 'markedById', as: 'markedBy' });

Lesson.hasMany(LessonGrade, { foreignKey: 'lessonId', as: 'grades' });
LessonGrade.belongsTo(Lesson, { foreignKey: 'lessonId', as: 'lesson' });
User.hasMany(LessonGrade, { foreignKey: 'postgraduateId', as: 'lessonGrades' });
LessonGrade.belongsTo(User, { foreignKey: 'postgraduateId', as: 'postgraduate' });
LessonGrade.belongsTo(User, { foreignKey: 'markedById', as: 'markedBy' });

Program.hasMany(PostgraduateProfile, { foreignKey: 'programId', as: 'profiles' });
PostgraduateProfile.belongsTo(Program, { foreignKey: 'programId', as: 'program' });

User.hasOne(PostgraduateProfile, { foreignKey: 'userId', as: 'postgraduateProfile' });
PostgraduateProfile.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Supervision, { foreignKey: 'postgraduateId', as: 'supervisionsAsPostgraduate' });
User.hasMany(Supervision, { foreignKey: 'supervisorId', as: 'supervisionsAsSupervisor' });
Supervision.belongsTo(User, { foreignKey: 'postgraduateId', as: 'postgraduate' });
Supervision.belongsTo(User, { foreignKey: 'supervisorId', as: 'supervisor' });

User.hasMany(DissertationTopic, { foreignKey: 'userId', as: 'dissertationTopics' });
DissertationTopic.belongsTo(User, { foreignKey: 'userId', as: 'author' });

User.hasMany(IndividualPlan, { foreignKey: 'userId', as: 'individualPlans' });
IndividualPlan.belongsTo(User, { foreignKey: 'userId', as: 'owner' });
IndividualPlan.hasMany(PlanItem, { foreignKey: 'planId', as: 'items' });
PlanItem.belongsTo(IndividualPlan, { foreignKey: 'planId', as: 'plan' });

User.hasMany(Milestone, { foreignKey: 'userId', as: 'milestones' });
Milestone.belongsTo(User, { foreignKey: 'userId', as: 'owner' });

User.hasMany(Publication, { foreignKey: 'userId', as: 'publications' });
Publication.belongsTo(User, { foreignKey: 'userId', as: 'author' });

User.hasMany(Attestation, { foreignKey: 'userId', as: 'attestations' });
Attestation.belongsTo(User, { foreignKey: 'userId', as: 'owner' });

User.hasMany(AcademicDocument, { foreignKey: 'userId', as: 'academicDocuments' });
AcademicDocument.belongsTo(User, { foreignKey: 'userId', as: 'owner' });

AcademicDocument.hasMany(DocumentFile, { foreignKey: 'documentId', as: 'files' });
DocumentFile.belongsTo(AcademicDocument, { foreignKey: 'documentId', as: 'document' });
DocumentFile.belongsTo(User, { foreignKey: 'uploadedById', as: 'uploadedBy' });

User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'userId', as: 'recipient' });

User.hasMany(DissertationTopicHistory, { foreignKey: 'userId', as: 'topicHistory' });
DissertationTopicHistory.belongsTo(User, { foreignKey: 'userId', as: 'postgraduate' });
DissertationTopicHistory.belongsTo(User, { foreignKey: 'changedById', as: 'changedBy' });

User.hasMany(AuditLog, { foreignKey: 'actorId', as: 'auditActions' });
AuditLog.belongsTo(User, { foreignKey: 'actorId', as: 'actor' });

const db = {
  sequelize,
  Sequelize,
  Group,
  User,
  Lesson,
  Attendance,
  LessonGrade,
  Message,
  Program,
  PostgraduateProfile,
  Supervision,
  DissertationTopic,
  IndividualPlan,
  PlanItem,
  Milestone,
  Publication,
  Attestation,
  AcademicDocument,
  DocumentFile,
  Notification,
  DissertationTopicHistory,
  AuditLog
};

db.sync = async (force = false) => {
  try {
    await sequelize.authenticate();
    console.log('✅ Подключение к базе данных установлено.');
    const alter = !force && process.env.DATABASE_SYNC_ALTER === '1';
    await sequelize.sync({ alter });
    if (alter) {
      console.log('✅ Синхронизация с alter (DATABASE_SYNC_ALTER=1).');
    } else {
      console.log('✅ Модели синхронизированы с базой данных.');
    }
    return true;
  } catch (error) {
    console.error('❌ Ошибка подключения к базе данных:', error);
    return false;
  }
};

module.exports = db;
