const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { Lesson, Group, User, LessonGrade } = require('../models');
const { Op, fn, col } = require('sequelize');
const { parseScheduleCsv } = require('../utils/parseScheduleCsv');
const { applyLessonStatusFields } = require('../utils/lessonStatus');
const { writeAudit } = require('../utils/audit');

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = String(file.originalname || '').toLowerCase();
    const okMime = ['text/csv', 'text/plain', 'application/vnd.ms-excel', 'application/csv'].includes(file.mimetype);
    if (okMime || name.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Допустим только CSV-файл'));
    }
  },
});

const scheduleInclude = [
  { model: Group, as: 'group', required: true },
  { model: User, as: 'teacher', attributes: ['id', 'fullName'], required: true },
  { model: User, as: 'substituteTeacher', attributes: ['id', 'fullName'], required: false }
];

/** Единый источник where/order для GET списка и для агрегата ETag. */
function getScheduleListConfig(req) {
  const { from, to } = req.query;
  const dateFilter = {};
  if (from) dateFilter[Op.gte] = from;
  if (to) dateFilter[Op.lte] = to;
  const whereDate = from || to ? { date: dateFilter } : {};
  const fromNorm = from ? String(from) : '';
  const toNorm = to ? String(to) : '';

  if (req.user.role === 'postgraduate') {
    const gid = req.user.groupId != null ? String(req.user.groupId) : '';
    return {
      where: { groupId: req.user.groupId, ...whereDate },
      order: [['date', 'ASC'], ['time', 'ASC']],
      scopeKey: `postgraduate:${req.user.id}:g${gid}:f${fromNorm}:t${toNorm}`
    };
  }
  if (req.user.role === 'professor') {
    return {
      where: { teacherId: req.user.id, ...whereDate },
      order: [['date', 'ASC'], ['time', 'ASC']],
      scopeKey: `professor:${req.user.id}:f${fromNorm}:t${toNorm}`
    };
  }
  return {
    where: whereDate,
    order: [[{ model: Group, as: 'group' }, 'name', 'ASC'], ['date', 'ASC'], ['time', 'ASC']],
    scopeKey: `full:${req.user.role}:${req.user.id}:f${fromNorm}:t${toNorm}`
  };
}

function normalizeEtagToken(tag) {
  if (!tag || typeof tag !== 'string') return '';
  let t = tag.trim().replace(/^W\//i, '').trim();
  if (t.startsWith('"') && t.endsWith('"') && t.length >= 2) {
    t = t.slice(1, -1);
  }
  return t.replace(/"/g, '');
}

function ifNoneMatchMatches(headerVal, serverEtag) {
  if (!headerVal || !serverEtag) return false;
  const serverNorm = normalizeEtagToken(serverEtag);
  const parts = String(headerVal).split(',').map((s) => normalizeEtagToken(s.trim()));
  return parts.some((p) => p === serverNorm);
}

async function computeScheduleETag(where) {
  const row = await Lesson.findOne({
    attributes: [
      [fn('COUNT', col('id')), 'cnt'],
      [fn('MAX', col('updatedAt')), 'maxU']
    ],
    where,
    raw: true
  });
  const cnt = row && row.cnt != null ? Number(row.cnt) : 0;
  const maxU = row && row.maxU ? new Date(row.maxU).toISOString() : 'none';
  return { cnt, maxU };
}

function buildScheduleETag(cnt, maxU, scopeKey) {
  const h = crypto.createHash('sha256').update(`${cnt}|${maxU}|${scopeKey}`).digest('hex').slice(0, 32);
  return `W/"sch-${h}"`;
}

// GET /api/schedule - Получить расписание
// Аспиранты видят только своё расписание; профессора и администраторы — полное
router.get('/', requireAuth, async (req, res) => {
  try {
    const { where, order, scopeKey } = getScheduleListConfig(req);
    const { cnt, maxU } = await computeScheduleETag(where);
    const etag = buildScheduleETag(cnt, maxU, scopeKey);

    res.set('ETag', etag);
    res.set('Cache-Control', 'private, max-age=0');

    if (ifNoneMatchMatches(req.headers['if-none-match'], etag)) {
      return res.status(304).end();
    }

    const lessons = await Lesson.findAll({
      include: scheduleInclude,
      where,
      order
    });
    return res.json(lessons);
  } catch (error) {
    console.error('Ошибка получения расписания:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/schedule — создание записи (администратор)
router.post('/', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    const { groupId, teacherId, time, subject, auditorium, date, status, substituteTeacherId } = req.body;

    if (!groupId || !teacherId || !date || !time || !subject) {
      return res.status(400).json({ error: 'groupId, teacherId, date, time и subject обязательны' });
    }

    const lesson = Lesson.build({
      groupId,
      teacherId,
      date,
      time,
      subject,
      auditorium,
    });

    const statusResult = applyLessonStatusFields(lesson, { status, substituteTeacherId, teacherId });
    if (statusResult.error) {
      return res.status(400).json({ error: statusResult.error });
    }

    await lesson.save();
    await writeAudit(req.user.id, 'lesson_create', 'Lesson', lesson.id, {
      groupId: lesson.groupId,
      date: lesson.date,
      subject: lesson.subject
    });

    const created = await Lesson.findByPk(lesson.id, { include: scheduleInclude });
    res.status(201).json(created);
  } catch (error) {
    console.error('Ошибка создания расписания:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/schedule/import — импорт из CSV (администратор)
router.post('/import', requireAuth, (req, res, next) => {
  csvUpload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Ошибка загрузки файла' });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    if (!req.file || !req.file.buffer?.length) {
      return res.status(400).json({ error: 'Выберите CSV-файл' });
    }

    const { rows, errors: parseErrors } = parseScheduleCsv(req.file.buffer);
    if (!rows.length && parseErrors.length) {
      return res.status(400).json({
        error: 'Не удалось разобрать CSV',
        created: 0,
        skipped: 0,
        errors: parseErrors,
      });
    }

    const [groups, teachers] = await Promise.all([
      Group.findAll(),
      User.findAll({ where: { role: 'professor' }, attributes: ['id', 'fullName'] }),
    ]);

    const groupByName = new Map(groups.map((g) => [String(g.name).trim().toLowerCase(), g]));
    const teacherByName = new Map(teachers.map((t) => [String(t.fullName).trim().toLowerCase(), t]));

    let created = 0;
    let skipped = 0;
    const errors = [...parseErrors];

    for (const row of rows) {
      const group = groupByName.get(row.groupName.toLowerCase());
      if (!group) {
        errors.push({ line: row.line, message: `Группа не найдена: "${row.groupName}"` });
        continue;
      }

      const teacher = teacherByName.get(row.teacherName.toLowerCase());
      if (!teacher) {
        errors.push({ line: row.line, message: `Преподаватель не найден: "${row.teacherName}"` });
        continue;
      }

      const existing = await Lesson.findOne({
        where: {
          groupId: group.id,
          teacherId: teacher.id,
          date: row.date,
          time: row.time,
          subject: row.subject,
        },
      });

      if (existing) {
        skipped += 1;
        continue;
      }

      await Lesson.create({
        groupId: group.id,
        teacherId: teacher.id,
        date: row.date,
        time: row.time,
        subject: row.subject,
        auditorium: row.auditorium,
      });
      created += 1;
    }

    if (!created && errors.length) {
      return res.status(400).json({
        error: 'Импорт не выполнен',
        created,
        skipped,
        errors,
      });
    }

    await writeAudit(req.user.id, 'schedule_import', 'Lesson', null, { created, skipped, errors: errors.length });

    return res.json({
      message: `Импорт завершён: добавлено ${created}, пропущено дубликатов ${skipped}`,
      created,
      skipped,
      errors,
    });
  } catch (error) {
    console.error('Ошибка импорта расписания:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// PUT /api/schedule/:id — обновление записи (администратор)
router.put('/:id', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    const lesson = await Lesson.findByPk(req.params.id);
    if (!lesson) {
      return res.status(404).json({ error: 'Запись расписания не найдена' });
    }

    const { groupId, teacherId, date, time, subject, auditorium, status, substituteTeacherId } = req.body;
    if (groupId !== undefined) lesson.groupId = groupId;
    if (teacherId !== undefined) lesson.teacherId = teacherId;
    if (date !== undefined) lesson.date = date;
    if (time !== undefined) lesson.time = time;
    if (subject !== undefined) lesson.subject = subject;
    if (auditorium !== undefined) lesson.auditorium = auditorium;

    if (status !== undefined || substituteTeacherId !== undefined) {
      const statusResult = applyLessonStatusFields(lesson, {
        status: status !== undefined ? status : lesson.status,
        substituteTeacherId,
        teacherId: lesson.teacherId,
      });
      if (statusResult.error) {
        return res.status(400).json({ error: statusResult.error });
      }
    }

    await lesson.save();
    await writeAudit(req.user.id, 'lesson_update', 'Lesson', lesson.id, {
      groupId: lesson.groupId,
      date: lesson.date,
      subject: lesson.subject
    });
    const updated = await Lesson.findByPk(lesson.id, { include: scheduleInclude });
    res.json(updated);
  } catch (error) {
    console.error('Ошибка обновления расписания:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// DELETE /api/schedule/:id — удаление записи (администратор)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    const lesson = await Lesson.findByPk(req.params.id);
    if (!lesson) {
      return res.status(404).json({ error: 'Запись расписания не найдена' });
    }

    const gradesCount = await LessonGrade.count({ where: { lessonId: lesson.id } });
    if (gradesCount > 0) {
      return res.status(400).json({ error: 'Нельзя удалить занятие: по нему уже есть оценки' });
    }

    const lessonId = lesson.id;
    await lesson.destroy();
    await writeAudit(req.user.id, 'lesson_delete', 'Lesson', lessonId, {});
    res.json({ message: 'Запись расписания удалена' });
  } catch (error) {
    console.error('Ошибка удаления расписания:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;

