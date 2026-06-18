const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  User,
  PostgraduateProfile,
  Milestone,
  IndividualPlan,
  AcademicDocument,
  Program
} = require('../models');

const adminProgOnly = [requireAuth, requireRole('program_admin')];

router.get('/overview', ...adminProgOnly, async (req, res) => {
  try {
    const [totalPostgraduates, totalProfessors] = await Promise.all([
      User.count({ where: { role: 'postgraduate' } }),
      User.count({ where: { role: 'professor' } })
    ]);

    const today = new Date().toISOString().slice(0, 10);
    const overdueMilestones = await Milestone.count({
      where: {
        dueDate: { [Op.lt]: today },
        status: { [Op.notIn]: ['done', 'skipped'] }
      }
    });

    const plansPending = await IndividualPlan.count({ where: { status: 'submitted' } });
    const docsReview = await AcademicDocument.count({ where: { status: 'on_review' } });

    res.json({
      counts: {
        postgraduates: totalPostgraduates,
        professors: totalProfessors,
        usersTotal: await User.count(),
        overdueMilestones,
        plansPendingApproval: plansPending,
        documentsOnReview: docsReview
      },
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('program-admin/overview:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.get('/postgraduates', ...adminProgOnly, async (req, res) => {
  try {
    const users = await User.findAll({
      where: { role: 'postgraduate' },
      attributes: { exclude: ['password'] },
      order: [['groupName', 'ASC'], ['fullName', 'ASC']]
    });
    const today = new Date().toISOString().slice(0, 10);
    const enriched = await Promise.all(
      users.map(async (u) => {
        const profile = await PostgraduateProfile.findOne({
          where: { userId: u.id },
          include: [{ model: Program, as: 'program', attributes: ['code', 'name'] }]
        });
        const overdue = await Milestone.count({
          where: {
            userId: u.id,
            dueDate: { [Op.lt]: today },
            status: { [Op.notIn]: ['done', 'skipped'] }
          }
        });
        const pendingPlan = await IndividualPlan.findOne({
          where: { userId: u.id, status: 'submitted' }
        });
        return {
          user: u.toSafeJSON(),
          profile,
          overdueMilestones: overdue,
          hasPlanPendingApproval: !!pendingPlan
        };
      })
    );
    res.json(enriched);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.get('/milestones/overdue', ...adminProgOnly, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const rows = await Milestone.findAll({
      where: {
        dueDate: { [Op.lt]: today },
        status: { [Op.notIn]: ['done', 'skipped'] }
      },
      include: [
        { model: User, as: 'owner', attributes: ['id', 'fullName', 'groupName', 'email'] }
      ],
      order: [['dueDate', 'ASC']]
    });
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.get('/export/postgraduates.csv', ...adminProgOnly, async (req, res) => {
  try {
    const users = await User.findAll({
      where: { role: 'postgraduate' },
      attributes: ['id', 'login', 'fullName', 'groupName', 'email', 'phone'],
      order: [['fullName', 'ASC']]
    });
    const header = 'id;login;fullName;groupName;email;phone;specialtyCode;department;program\n';
    const lines = await Promise.all(
      users.map(async (u) => {
        const p = await PostgraduateProfile.findOne({ where: { userId: u.id } });
        const prog = p && p.programId
          ? await Program.findByPk(p.programId)
          : null;
        const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        return [
          u.id,
          esc(u.login),
          esc(u.fullName),
          esc(u.groupName),
          esc(u.email),
          esc(u.phone),
          esc(p ? p.specialtyCode : ''),
          esc(p ? p.department : ''),
          esc(prog ? prog.name : '')
        ].join(';');
      })
    );
    const csv = '\uFEFF' + header + lines.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="postgraduates.csv"');
    res.send(csv);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.get('/programs', ...adminProgOnly, async (_req, res) => {
  try {
    const programs = await Program.findAll({ order: [['name', 'ASC']] });
    res.json(programs);
  } catch (e) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.post('/programs', ...adminProgOnly, async (req, res) => {
  try {
    const { code, name, description } = req.body;
    if (!code || !name) {
      return res.status(400).json({ error: 'Укажите code и name' });
    }
    const p = await Program.create({
      code: String(code).trim(),
      name: String(name).trim(),
      description: description || null
    });
    res.status(201).json(p);
  } catch (e) {
    if (e.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Код программы уже занят' });
    }
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
