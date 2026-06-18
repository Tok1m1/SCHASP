const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { requireAuth } = require('../middleware/auth');
const {
  User,
  Message,
  Supervision,
  Group,
  Lesson,
  Attestation,
  AuditLog
} = require('../models');
const { generateTimesheetBuffer, buildTimesheetFilename } = require('../utils/timesheetGenerator');
const { writeAudit } = require('../utils/audit');
const {
  normalizeAttestationDecision,
  isValidAttestationDecision
} = require('../utils/attestationDecisions');

const ALLOWED_ROLES = ['admin', 'postgraduate', 'professor'];

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Требуются права администратора' });
  }
  next();
};

async function resolveGroupFields(groupId) {
  if (groupId === null || groupId === '') {
    return { groupId: null, groupName: null };
  }
  const id = parseInt(groupId, 10);
  if (!id) {
    return null;
  }
  const group = await Group.findByPk(id);
  if (!group) {
    return null;
  }
  return { groupId: group.id, groupName: group.name };
}

async function groupWithCounts(group) {
  const json = group.toJSON();
  const [members, lessons] = await Promise.all([
    User.count({ where: { groupId: group.id } }),
    Lesson.count({ where: { groupId: group.id } })
  ]);
  return { ...json, _count: { members, lessons } };
}

function parseAttestationDecision(decision) {
  if (decision === undefined) return { skip: true };
  if (decision === null || decision === '') return { value: null };
  const normalized = normalizeAttestationDecision(decision);
  if (!normalized || !isValidAttestationDecision(normalized)) {
    return { error: 'Недопустимое решение (passed, failed, rescheduled, pending)' };
  }
  return { value: normalized };
}

function buildAuditLogWhere(query) {
  const where = {};
  if (query.actorId) {
    where.actorId = parseInt(query.actorId, 10);
  }
  if (query.entityType) {
    where.entityType = String(query.entityType).trim();
  }
  if (query.action) {
    where.action = { [Op.iLike]: `%${String(query.action).trim()}%` };
  }
  if (query.from || query.to) {
    where.createdAt = {};
    if (query.from) where.createdAt[Op.gte] = new Date(String(query.from));
    if (query.to) {
      const toDate = new Date(String(query.to));
      toDate.setHours(23, 59, 59, 999);
      where.createdAt[Op.lte] = toDate;
    }
  }
  return where;
}

router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  const role = req.query.role ? String(req.query.role) : null;
  const where = role ? { role } : undefined;
  const users = await User.findAll({
    where,
    attributes: { exclude: ['password'] },
    order: [['createdAt', 'DESC']]
  });
  res.json(users);
});

router.get('/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const user = await User.findByPk(req.params.id, {
    attributes: { exclude: ['password'] }
  });
  if (!user) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }
  res.json(user);
});

router.post('/users', requireAuth, requireAdmin, async (req, res) => {
  const { login, password, fullName, role, groupId, email, phone, tabNumber, position } = req.body;

  if (!login || !password || !fullName || !role) {
    return res.status(400).json({ error: 'Логин, пароль, ФИО и роль обязательны' });
  }
  if (!ALLOWED_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Недопустимая роль' });
  }
  const existingUser = await User.findOne({ where: { login } });
  if (existingUser) {
    return res.status(400).json({ error: 'Пользователь с таким логином уже существует' });
  }

  let groupFields = {};
  if (groupId !== undefined) {
    const resolved = await resolveGroupFields(groupId);
    if (resolved === null) {
      return res.status(400).json({ error: 'Группа не найдена' });
    }
    groupFields = resolved;
  }

  const user = await User.create({
    login,
    password,
    fullName,
    role,
    ...groupFields,
    email,
    phone,
    tabNumber,
    position,
  });
  await writeAudit(req.user.id, 'user_create', 'User', user.id, { login: user.login, role: user.role });
  res.status(201).json(user.toSafeJSON());
});

router.put('/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }
  const { login, password, fullName, role, groupId, email, phone, tabNumber, position } = req.body;

  if (login && login !== user.login) {
    const existingUser = await User.findOne({ where: { login } });
    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с таким логином уже существует' });
    }
    user.login = login;
  }
  if (password) user.password = password;
  if (fullName) user.fullName = fullName;
  if (role) {
    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Недопустимая роль' });
    }
    user.role = role;
  }
  if (groupId !== undefined) {
    const resolved = await resolveGroupFields(groupId);
    if (resolved === null) {
      return res.status(400).json({ error: 'Группа не найдена' });
    }
    user.groupId = resolved.groupId;
    user.groupName = resolved.groupName;
  }
  if (email !== undefined) user.email = email;
  if (phone !== undefined) user.phone = phone;
  if (tabNumber !== undefined) user.tabNumber = tabNumber;
  if (position !== undefined) user.position = position;
  await user.save();
  await writeAudit(req.user.id, 'user_update', 'User', user.id, { login: user.login, role: user.role });
  res.json(user.toSafeJSON());
});

router.delete('/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }
  if (user.id === req.user.id) {
    return res.status(400).json({ error: 'Нельзя удалить самого себя' });
  }
  const deletedId = user.id;
  const deletedLogin = user.login;
  await user.destroy();
  await writeAudit(req.user.id, 'user_delete', 'User', deletedId, { login: deletedLogin });
  res.json({ message: 'Пользователь удалён' });
});

router.get('/messages', requireAuth, requireAdmin, async (req, res) => {
  const messages = await Message.findAll({
    include: [
      {
        model: User,
        as: 'sender',
        attributes: ['id', 'fullName', 'login']
      },
      {
        model: User,
        as: 'recipient',
        attributes: ['id', 'fullName', 'login']
      }
    ],
    order: [['createdAt', 'DESC']]
  });
  res.json(messages);
});

router.delete('/messages/:id', requireAuth, requireAdmin, async (req, res) => {
  const message = await Message.findByPk(req.params.id);
  if (!message) {
    return res.status(404).json({ error: 'Сообщение не найдено' });
  }
  const messageId = message.id;
  await message.destroy();
  await writeAudit(req.user.id, 'message_delete', 'Message', messageId, {});
  res.json({ message: 'Сообщение удалено' });
});

router.post('/supervisions', requireAuth, requireAdmin, async (req, res) => {
  const { postgraduateId, supervisorId, supervisionKind, startedAt } = req.body;
  if (!postgraduateId || !supervisorId) {
    return res.status(400).json({ error: 'Укажите postgraduateId и supervisorId' });
  }
  const pg = await User.findByPk(postgraduateId);
  const sup = await User.findByPk(supervisorId);
  if (!pg || pg.role !== 'postgraduate') {
    return res.status(400).json({ error: 'Некорректный аспирант' });
  }
  if (!sup || sup.role !== 'professor') {
    return res.status(400).json({ error: 'Некорректный профессор' });
  }
  const kind = supervisionKind === 'co_supervisor' ? 'co_supervisor' : 'primary';
  const row = await Supervision.create({
    postgraduateId,
    supervisorId,
    supervisionKind: kind,
    startedAt: startedAt || new Date().toISOString().slice(0, 10),
    isActive: true
  });
  res.status(201).json(row);
});

router.patch('/supervisions/:id', requireAuth, requireAdmin, async (req, res) => {
  const row = await Supervision.findByPk(req.params.id);
  if (!row) return res.status(404).json({ error: 'Не найдено' });
  const { isActive, endedAt } = req.body;
  if (isActive !== undefined) row.isActive = !!isActive;
  if (endedAt !== undefined) row.endedAt = endedAt;
  await row.save();
  res.json(row);
});

router.get('/groups', requireAuth, requireAdmin, async (req, res) => {
  const groups = await Group.findAll({ order: [['name', 'ASC']] });
  const enriched = await Promise.all(groups.map((g) => groupWithCounts(g)));
  res.json(enriched);
});

router.get('/groups/:id', requireAuth, requireAdmin, async (req, res) => {
  const group = await Group.findByPk(req.params.id);
  if (!group) {
    return res.status(404).json({ error: 'Группа не найдена' });
  }
  res.json(await groupWithCounts(group));
});

router.post('/groups', requireAuth, requireAdmin, async (req, res) => {
  const { name, description } = req.body;
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'Название группы обязательно' });
  }
  const trimmed = String(name).trim();
  const existing = await Group.findOne({ where: { name: trimmed } });
  if (existing) {
    return res.status(400).json({ error: 'Группа с таким названием уже существует' });
  }
  const group = await Group.create({
    name: trimmed,
    description: description || null
  });
  await writeAudit(req.user.id, 'group_create', 'Group', group.id, { name: group.name });
  res.status(201).json(await groupWithCounts(group));
});

router.put('/groups/:id', requireAuth, requireAdmin, async (req, res) => {
  const group = await Group.findByPk(req.params.id);
  if (!group) {
    return res.status(404).json({ error: 'Группа не найдена' });
  }
  const { name, description } = req.body;
  const oldName = group.name;
  if (name !== undefined) {
    const trimmed = String(name).trim();
    if (!trimmed) {
      return res.status(400).json({ error: 'Название группы не может быть пустым' });
    }
    if (trimmed !== group.name) {
      const existing = await Group.findOne({ where: { name: trimmed } });
      if (existing) {
        return res.status(400).json({ error: 'Группа с таким названием уже существует' });
      }
      group.name = trimmed;
    }
  }
  if (description !== undefined) group.description = description || null;
  await group.save();
  if (group.name !== oldName) {
    await User.update(
      { groupName: group.name },
      { where: { groupId: group.id } }
    );
  }
  await writeAudit(req.user.id, 'group_update', 'Group', group.id, { name: group.name });
  res.json(await groupWithCounts(group));
});

router.delete('/groups/:id', requireAuth, requireAdmin, async (req, res) => {
  const group = await Group.findByPk(req.params.id);
  if (!group) {
    return res.status(404).json({ error: 'Группа не найдена' });
  }
  const [members, lessons] = await Promise.all([
    User.count({ where: { groupId: group.id } }),
    Lesson.count({ where: { groupId: group.id } })
  ]);
  if (members > 0 || lessons > 0) {
    return res.status(400).json({
      error: `Нельзя удалить группу: ${members} пользователей, ${lessons} занятий`
    });
  }
  const groupId = group.id;
  const groupName = group.name;
  await group.destroy();
  await writeAudit(req.user.id, 'group_delete', 'Group', groupId, { name: groupName });
  res.json({ message: 'Группа удалена' });
});

router.get('/attestations', requireAuth, requireAdmin, async (req, res) => {
  const where = {};
  if (req.query.userId) {
    where.userId = parseInt(req.query.userId, 10);
  }
  const rows = await Attestation.findAll({
    where,
    include: [{
      model: User,
      as: 'owner',
      attributes: ['id', 'fullName', 'login']
    }],
    order: [['attestedAt', 'DESC'], ['createdAt', 'DESC']]
  });
  res.json(rows);
});

router.post('/attestations', requireAuth, requireAdmin, async (req, res) => {
  const { userId, periodLabel, decision, notes, attestedAt } = req.body;
  if (!userId || !periodLabel || !String(periodLabel).trim()) {
    return res.status(400).json({ error: 'Укажите userId и periodLabel' });
  }
  const pg = await User.findByPk(userId);
  if (!pg || pg.role !== 'postgraduate') {
    return res.status(400).json({ error: 'Некорректный аспирант' });
  }
  const decisionParsed = parseAttestationDecision(decision);
  if (decisionParsed.error) {
    return res.status(400).json({ error: decisionParsed.error });
  }
  const row = await Attestation.create({
    userId: pg.id,
    periodLabel: String(periodLabel).trim(),
    decision: decisionParsed.value,
    notes: notes || null,
    attestedAt: attestedAt || null
  });
  await writeAudit(req.user.id, 'attestation_create', 'Attestation', row.id, { userId: pg.id });
  res.status(201).json(row);
});

router.put('/attestations/:id', requireAuth, requireAdmin, async (req, res) => {
  const row = await Attestation.findByPk(req.params.id);
  if (!row) {
    return res.status(404).json({ error: 'Аттестация не найдена' });
  }
  const { userId, periodLabel, decision, notes, attestedAt } = req.body;
  if (userId !== undefined) {
    const pg = await User.findByPk(userId);
    if (!pg || pg.role !== 'postgraduate') {
      return res.status(400).json({ error: 'Некорректный аспирант' });
    }
    row.userId = pg.id;
  }
  if (periodLabel !== undefined) {
    const trimmed = String(periodLabel).trim();
    if (!trimmed) {
      return res.status(400).json({ error: 'periodLabel не может быть пустым' });
    }
    row.periodLabel = trimmed;
  }
  if (decision !== undefined) {
    const decisionParsed = parseAttestationDecision(decision);
    if (decisionParsed.error) {
      return res.status(400).json({ error: decisionParsed.error });
    }
    row.decision = decisionParsed.value;
  }
  if (notes !== undefined) row.notes = notes || null;
  if (attestedAt !== undefined) row.attestedAt = attestedAt || null;
  await row.save();
  await writeAudit(req.user.id, 'attestation_update', 'Attestation', row.id, { userId: row.userId });
  res.json(row);
});

router.delete('/attestations/:id', requireAuth, requireAdmin, async (req, res) => {
  const row = await Attestation.findByPk(req.params.id);
  if (!row) {
    return res.status(404).json({ error: 'Аттестация не найдена' });
  }
  const attestationId = row.id;
  const userId = row.userId;
  await row.destroy();
  await writeAudit(req.user.id, 'attestation_delete', 'Attestation', attestationId, { userId });
  res.json({ message: 'Аттестация удалена' });
});

router.get('/audit-logs', requireAuth, requireAdmin, async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const where = buildAuditLogWhere(req.query);
  const { rows, count } = await AuditLog.findAndCountAll({
    where,
    include: [{
      model: User,
      as: 'actor',
      attributes: ['id', 'fullName', 'login']
    }],
    order: [['createdAt', 'DESC']],
    limit,
    offset
  });
  res.json({ rows, total: count, limit, offset });
});

router.get('/audit-logs/export', requireAuth, requireAdmin, async (req, res) => {
  const where = buildAuditLogWhere(req.query);
  const rows = await AuditLog.findAll({
    where,
    include: [{
      model: User,
      as: 'actor',
      attributes: ['id', 'fullName', 'login']
    }],
    order: [['createdAt', 'DESC']],
    limit: 5000
  });

  const header = ['createdAt', 'actorLogin', 'actorName', 'action', 'entityType', 'entityId', 'details'];
  const escapeCsv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [
    header.join(','),
    ...rows.map((log) => [
      log.createdAt ? new Date(log.createdAt).toISOString() : '',
      log.actor?.login || '',
      log.actor?.fullName || '',
      log.action,
      log.entityType,
      log.entityId ?? '',
      log.details || ''
    ].map(escapeCsv).join(','))
  ];

  const filename = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
  res.send(`\uFEFF${lines.join('\n')}`);
});

router.get('/timesheet/export', requireAuth, requireAdmin, async (req, res) => {
  try {
    const year = Number(req.query.year);
    const month = Number(req.query.month);
    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({ error: 'Укажите year и month (1–12)' });
    }

    const buffer = await generateTimesheetBuffer(year, month);
    if (!buffer) {
      return res.status(404).json({ error: 'Нет данных за период' });
    }

    const filename = buildTimesheetFilename(year, month);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
    );
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Ошибка генерации табеля:', error);
    res.status(500).json({ error: 'Не удалось сформировать табель' });
  }
});

module.exports = router;
