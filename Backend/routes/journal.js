const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { User, Group, Lesson, Attendance, LessonGrade } = require('../models');
const { Op } = require('sequelize');
const { writeAudit } = require('../utils/audit');

const requireProfessorOrAdmin = (req, res, next) => {
  if (!['professor', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Требуются права профессора или администратора' });
  }
  next();
};

function ensureProfessorOwnsLesson(req, lesson) {
  if (req.user.role !== 'professor') return true;
  return lesson.teacherId && req.user.id && lesson.teacherId === req.user.id;
}

function requirePostgraduate(req, res, next) {
  if (req.user.role !== 'postgraduate') {
    return res.status(403).json({ error: 'Доступно только для аспиранта' });
  }
  next();
}

async function getLessonOr404(lessonId, include = true) {
  const lesson = await Lesson.findByPk(lessonId, include ? {
    include: [
      { model: User, as: 'teacher', attributes: ['id', 'fullName', 'login'] },
      { model: Group, as: 'group', attributes: ['id', 'name'] }
    ]
  } : undefined);
  return lesson || null;
}

// GET /api/journal/lessons?date=YYYY-MM-DD - список занятий на дату (одно занятие = одна запись)
router.get('/lessons', requireAuth, requireProfessorOrAdmin, async (req, res) => {
  const date = String(req.query.date || '').trim();
  if (!date) return res.status(400).json({ error: 'Укажите date=YYYY-MM-DD' });

  const where = { date };
  if (req.user.role === 'professor') {
    where.teacherId = req.user.id;
  }

  const lessons = await Lesson.findAll({
    where,
    include: [
      { model: User, as: 'teacher', attributes: ['id', 'fullName'] },
      { model: Group, as: 'group', attributes: ['id', 'name'] }
    ],
    order: [['time', 'ASC'], ['id', 'ASC']]
  });

  res.json(lessons);
});

// GET /api/journal/groups?lessonId=... - группа занятия (всегда 1)
router.get('/groups', requireAuth, requireProfessorOrAdmin, async (req, res) => {
  const lessonId = Number(req.query.lessonId || req.query.scheduleId); // scheduleId for backward compatibility
  if (!lessonId) return res.status(400).json({ error: 'Укажите lessonId' });

  const lesson = await getLessonOr404(lessonId, true);
  if (!lesson) return res.status(404).json({ error: 'Занятие не найдено' });
  if (!ensureProfessorOwnsLesson(req, lesson)) {
    return res.status(403).json({ error: 'Доступ запрещён. Это не ваше занятие.' });
  }

  res.json([lesson.group?.name].filter(Boolean));
});

// GET /api/journal/roster?lessonId=... - список аспирантов группы занятия
router.get('/roster', requireAuth, requireProfessorOrAdmin, async (req, res) => {
  const lessonId = Number(req.query.lessonId || req.query.scheduleId);
  if (!lessonId) return res.status(400).json({ error: 'Укажите lessonId' });

  const lesson = await getLessonOr404(lessonId, true);
  if (!lesson) return res.status(404).json({ error: 'Занятие не найдено' });
  if (!ensureProfessorOwnsLesson(req, lesson)) {
    return res.status(403).json({ error: 'Доступ запрещён. Это не ваше занятие.' });
  }

  const students = await User.findAll({
    where: { role: 'postgraduate', groupId: lesson.groupId },
    attributes: ['id', 'fullName', 'groupName', 'groupId'],
    order: [['fullName', 'ASC']]
  });

  res.json(students);
});

// GET /api/journal/entry?lessonId=... - данные журнала (посещаемость+оценки) по занятию
router.get('/entry', requireAuth, requireProfessorOrAdmin, async (req, res) => {
  const lessonId = Number(req.query.lessonId || req.query.scheduleId);
  if (!lessonId) return res.status(400).json({ error: 'Укажите lessonId' });

  const lesson = await getLessonOr404(lessonId, true);
  if (!lesson) return res.status(404).json({ error: 'Занятие не найдено' });
  if (!ensureProfessorOwnsLesson(req, lesson)) {
    return res.status(403).json({ error: 'Доступ запрещён. Это не ваше занятие.' });
  }

  const students = await User.findAll({
    where: { role: 'postgraduate', groupId: lesson.groupId },
    attributes: ['id', 'fullName', 'groupName', 'groupId'],
    order: [['fullName', 'ASC']]
  });

  const attendance = await Attendance.findAll({ where: { lessonId } });
  const attendanceByPostgraduateId = {};
  attendance.forEach((a) => {
    if (a.postgraduateId) attendanceByPostgraduateId[a.postgraduateId] = { status: a.status, comment: a.comment || '' };
  });

  const grades = await LessonGrade.findAll({ where: { lessonId } });
  const gradesByPostgraduateId = {};
  grades.forEach((g) => {
    if (g.postgraduateId) gradesByPostgraduateId[g.postgraduateId] = { grade: g.grade, comment: g.comment || '' };
  });

  res.json({
    lesson,
    groupName: lesson.group?.name || '',
    students,
    attendanceByPostgraduateId,
    gradesByPostgraduateId
  });
});

// POST /api/journal/entry - сохранить посещаемость+оценки одним запросом
router.post('/entry', requireAuth, requireProfessorOrAdmin, async (req, res) => {
  const lessonId = Number(req.body?.lessonId || req.body?.scheduleId);
  const groupName = String(req.body?.groupName || '').trim();
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
  if (!lessonId || !rows) {
    return res.status(400).json({ error: 'Нужны lessonId и rows[]' });
  }

  const lesson = await getLessonOr404(lessonId, false);
  if (!lesson) return res.status(404).json({ error: 'Занятие не найдено' });
  if (!ensureProfessorOwnsLesson(req, lesson)) {
    return res.status(403).json({ error: 'Доступ запрещён. Это не ваше занятие.' });
  }

  const studentIds = rows.map((r) => Number(r.postgraduateId)).filter(Boolean);
  const students = await User.findAll({
    where: {
      id: { [Op.in]: studentIds.length ? studentIds : [-1] },
      role: 'postgraduate',
      groupId: lesson.groupId
    },
    attributes: ['id']
  });
  const allowedIds = new Set(students.map((s) => s.id));

  const attendanceRows = rows
    .map((r) => ({
      lessonId,
      postgraduateId: Number(r.postgraduateId),
      status: r.status || 'unknown',
      comment: r.attendanceComment || r.comment || null,
      markedById: req.user.id
    }))
    .filter((r) => r.postgraduateId && allowedIds.has(r.postgraduateId));

  await Attendance.bulkCreate(attendanceRows, {
    updateOnDuplicate: ['status', 'comment', 'markedById', 'updatedAt']
  });

  const gradeRows = rows
    .map((r) => ({
      lessonId,
      postgraduateId: Number(r.postgraduateId),
      grade: String(r.grade || '').trim(),
      comment: r.gradeComment ?? r.comment ?? null,
      markedById: req.user.id
    }))
    .filter((r) => r.postgraduateId && allowedIds.has(r.postgraduateId) && r.grade);

  await LessonGrade.bulkCreate(gradeRows, {
    updateOnDuplicate: ['grade', 'comment', 'markedById', 'updatedAt']
  });

  await writeAudit(req.user.id, 'journal_entry_save', 'Lesson', lessonId, {
    attendance: attendanceRows.length,
    grades: gradeRows.length
  });

  res.json({ message: 'Сохранено', attendance: attendanceRows.length, grades: gradeRows.length });
});

// GET /api/journal/my-attendance?from=YYYY-MM-DD&to=YYYY-MM-DD - отметки посещаемости текущего аспиранта
router.get('/my-attendance', requireAuth, async (req, res) => {
  if (req.user.role !== 'postgraduate') {
    return res.status(403).json({ error: 'Доступно только для аспиранта' });
  }

  const { from, to } = req.query;
  const dateFilter = {};
  if (from) dateFilter[Op.gte] = from;
  if (to) dateFilter[Op.lte] = to;
  const lessonWhere = from || to ? { date: dateFilter } : {};

  const marks = await Attendance.findAll({
    where: { postgraduateId: req.user.id },
    include: [
      {
        model: Lesson,
        as: 'lesson',
        where: lessonWhere,
        required: true,
        include: [
          { model: User, as: 'teacher', attributes: ['id', 'fullName'] },
          { model: Group, as: 'group', attributes: ['id', 'name'] }
        ]
      }
    ],
    order: [[{ model: Lesson, as: 'lesson' }, 'date', 'ASC'], [{ model: Lesson, as: 'lesson' }, 'time', 'ASC']]
  });

  res.json(marks);
});

// GET /api/journal/my-grades - оценки текущего аспиранта
router.get('/my-grades', requireAuth, requirePostgraduate, async (req, res) => {
  const grades = await LessonGrade.findAll({
    where: { postgraduateId: req.user.id },
    include: [
      {
        model: Lesson,
        as: 'lesson',
        required: true,
        include: [
          { model: User, as: 'teacher', attributes: ['id', 'fullName'] },
          { model: Group, as: 'group', attributes: ['id', 'name'] }
        ]
      }
    ],
    order: [[{ model: Lesson, as: 'lesson' }, 'date', 'ASC'], [{ model: Lesson, as: 'lesson' }, 'time', 'ASC']]
  });
  res.json(grades);
});

// Старые grade endpoints больше не используются: оценки теперь в LessonGrade и сохраняются через POST /api/journal/entry.

module.exports = router;


