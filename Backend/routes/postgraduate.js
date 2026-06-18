const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { writeAudit } = require('../utils/audit');
const {
  User,
  PostgraduateProfile,
  Supervision,
  DissertationTopic,
  DissertationTopicHistory,
  IndividualPlan,
  PlanItem,
  Milestone,
  Publication,
  Attestation,
  AcademicDocument,
  DocumentFile,
  Program
} = require('../models');

const pgOnly = [requireAuth, requireRole('postgraduate')];

const uploadRoot = path.join(__dirname, '../uploads/documents');
if (!fs.existsSync(uploadRoot)) {
  fs.mkdirSync(uploadRoot, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadRoot),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').slice(0, 12);
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'application/pdf', 
    'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg', 
    'image/png'
  ];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Недопустимый формат файла'), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter
});

async function loadDashboardPayload(userId) {
  const [
    profile,
    topics,
    plans,
    milestones,
    publications,
    attestations,
    documents,
    supervisions
  ] = await Promise.all([
    PostgraduateProfile.findOne({
      where: { userId },
      include: [{ model: Program, as: 'program', attributes: ['id', 'code', 'name'] }]
    }),
    DissertationTopic.findAll({ where: { userId }, order: [['updatedAt', 'DESC']] }),
    IndividualPlan.findAll({
      where: { userId },
      include: [{ model: PlanItem, as: 'items' }],
      order: [['academicYear', 'DESC']]
    }),
    Milestone.findAll({ where: { userId }, order: [['dueDate', 'ASC']] }),
    Publication.findAll({ where: { userId }, order: [['year', 'DESC'], ['createdAt', 'DESC']] }),
    Attestation.findAll({ where: { userId }, order: [['attestedAt', 'DESC']] }),
    AcademicDocument.findAll({
      where: { userId },
      order: [['updatedAt', 'DESC']],
      include: [{ model: DocumentFile, as: 'files' }]
    }),
    Supervision.findAll({
      where: { postgraduateId: userId, isActive: true },
      include: [{ model: User, as: 'supervisor', attributes: ['id', 'fullName', 'login', 'email'] }]
    })
  ]);

  return {
    profile,
    dissertationTopics: topics,
    individualPlans: plans,
    milestones,
    publications,
    attestations,
    documents,
    supervisions
  };
}

router.get('/dashboard', ...pgOnly, async (req, res) => {
  
    const data = await loadDashboardPayload(req.user.id);
    res.json(data);
  
});

router.get('/programs', ...pgOnly, async (_req, res) => {
  
    const programs = await Program.findAll({ order: [['name', 'ASC']] });
    res.json(programs);
  
});

router.put('/profile', ...pgOnly, async (req, res) => {
  
    const { enrollmentYear, department, specialtyCode, studyForm, programId } = req.body;
    let profile = await PostgraduateProfile.findOne({ where: { userId: req.user.id } });
    if (!profile) {
      profile = await PostgraduateProfile.create({
        userId: req.user.id,
        enrollmentYear: enrollmentYear ?? null,
        department: department ?? null,
        specialtyCode: specialtyCode ?? null,
        studyForm: studyForm ?? null,
        programId: programId ?? null
      });
    } else {
      if (enrollmentYear !== undefined) profile.enrollmentYear = enrollmentYear;
      if (department !== undefined) profile.department = department;
      if (specialtyCode !== undefined) profile.specialtyCode = specialtyCode;
      if (studyForm !== undefined) profile.studyForm = studyForm;
      if (programId !== undefined) profile.programId = programId || null;
      await profile.save();
    }
    await writeAudit(req.user.id, 'postgraduate_profile_update', 'PostgraduateProfile', profile.id, {});
    const fresh = await PostgraduateProfile.findOne({
      where: { userId: req.user.id },
      include: [{ model: Program, as: 'program', attributes: ['id', 'code', 'name'] }]
    });
    res.json(fresh);
  
});

router.post('/milestones', ...pgOnly, async (req, res) => {
  
    const { title, milestoneType, dueDate, status } = req.body;
    if (!title || String(title).trim() === '') {
      return res.status(400).json({ error: 'Укажите название вехи' });
    }
    const m = await Milestone.create({
      userId: req.user.id,
      title: String(title).trim(),
      milestoneType: milestoneType || null,
      dueDate: dueDate || null,
      status: status && ['pending', 'in_progress', 'done', 'skipped'].includes(status) ? status : 'pending'
    });
    await writeAudit(req.user.id, 'milestone_create', 'Milestone', m.id, { title: m.title });
    res.status(201).json(m);
  
});

router.put('/milestones/:id', ...pgOnly, async (req, res) => {
  
    const m = await Milestone.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!m) return res.status(404).json({ error: 'Веха не найдена' });
    const { title, milestoneType, dueDate, status } = req.body;
    if (title !== undefined) m.title = String(title).trim();
    if (milestoneType !== undefined) m.milestoneType = milestoneType;
    if (dueDate !== undefined) m.dueDate = dueDate;
    if (status !== undefined && ['pending', 'in_progress', 'done', 'skipped'].includes(status)) m.status = status;
    await m.save();
    await writeAudit(req.user.id, 'milestone_update', 'Milestone', m.id, {});
    res.json(m);
  
});

router.delete('/milestones/:id', ...pgOnly, async (req, res) => {
  
    const m = await Milestone.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!m) return res.status(404).json({ error: 'Веха не найдена' });
    await m.destroy();
    await writeAudit(req.user.id, 'milestone_delete', 'Milestone', parseInt(req.params.id, 10), {});
    res.status(204).end();
  
});

router.post('/publications', ...pgOnly, async (req, res) => {
  
    const { title, venue, year, doi, indexing, status } = req.body;
    if (!title) return res.status(400).json({ error: 'Укажите название' });
    const p = await Publication.create({
      userId: req.user.id,
      title,
      venue: venue || null,
      year: year != null ? parseInt(year, 10) : null,
      doi: doi || null,
      indexing: indexing || null,
      status: status && ['draft', 'submitted', 'verified', 'rejected'].includes(status) ? status : 'draft'
    });
    await writeAudit(req.user.id, 'publication_create', 'Publication', p.id, {});
    res.status(201).json(p);
  
});

router.put('/publications/:id', ...pgOnly, async (req, res) => {
  
    const p = await Publication.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!p) return res.status(404).json({ error: 'Не найдено' });
    const { title, venue, year, doi, indexing, status } = req.body;
    if (title !== undefined) p.title = title;
    if (venue !== undefined) p.venue = venue;
    if (year !== undefined) p.year = year != null ? parseInt(year, 10) : null;
    if (doi !== undefined) p.doi = doi;
    if (indexing !== undefined) p.indexing = indexing;
    if (status !== undefined && ['draft', 'submitted', 'verified', 'rejected'].includes(status)) p.status = status;
    await p.save();
    res.json(p);
  
});

router.delete('/publications/:id', ...pgOnly, async (req, res) => {
  
    const p = await Publication.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!p) return res.status(404).json({ error: 'Не найдено' });
    await p.destroy();
    res.status(204).end();
  
});

router.post('/documents', ...pgOnly, async (req, res) => {
  
    const { title, documentType, notes } = req.body;
    if (!title || !documentType) {
      return res.status(400).json({ error: 'Укажите название и тип документа' });
    }
    const d = await AcademicDocument.create({
      userId: req.user.id,
      title,
      documentType,
      status: 'draft',
      notes: notes || null
    });
    await writeAudit(req.user.id, 'document_create', 'AcademicDocument', d.id, {});
    res.status(201).json(d);
  
});

router.put('/documents/:id', ...pgOnly, async (req, res) => {
  
    const d = await AcademicDocument.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!d) return res.status(404).json({ error: 'Не найдено' });
    const { title, notes, status } = req.body;
    const editable = ['draft', 'rejected', 'on_review'].includes(d.status);
    if (!editable && d.status === 'approved') {
      return res.status(400).json({ error: 'Утверждённый документ нельзя изменить' });
    }
    if (title !== undefined) d.title = title;
    if (notes !== undefined) d.notes = notes;
    if (status !== undefined) {
      if (!['draft', 'on_review'].includes(status)) {
        return res.status(400).json({ error: 'Аспирант может переводить документ только в draft или on_review' });
      }
      if (status === 'on_review' && ['draft', 'rejected'].includes(d.status)) d.status = 'on_review';
      if (status === 'draft' && d.status === 'rejected') d.status = 'draft';
    }
    await d.save();
    res.json(d);
  
});

router.post('/documents/:id/submit-review', ...pgOnly, async (req, res) => {
  
    const d = await AcademicDocument.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!d) return res.status(404).json({ error: 'Не найдено' });
    if (!['draft', 'rejected'].includes(d.status)) {
      return res.status(400).json({ error: 'Отправка на проверку недоступна' });
    }
    d.status = 'on_review';
    await d.save();
    res.json(d);
  
});

router.post('/documents/:id/files', ...pgOnly, upload.single('file'), async (req, res) => {
  
    const d = await AcademicDocument.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!d) return res.status(404).json({ error: 'Документ не найден' });
    if (!req.file) return res.status(400).json({ error: 'Файл не передан' });
    const row = await DocumentFile.create({
      documentId: d.id,
      storedName: req.file.filename,
      originalName: req.file.originalname || req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedById: req.user.id
    });
    res.status(201).json(row);
  
});

router.get('/documents/:id/files/:fileId/download', ...pgOnly, async (req, res) => {
  
    const d = await AcademicDocument.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!d) return res.status(404).json({ error: 'Не найдено' });
    const f = await DocumentFile.findOne({ where: { id: req.params.fileId, documentId: d.id } });
    if (!f) return res.status(404).json({ error: 'Файл не найден' });
    const fp = path.join(uploadRoot, f.storedName);
    if (!fs.existsSync(fp)) return res.status(404).json({ error: 'Файл отсутствует на диске' });
    res.download(fp, f.originalName);
  
});

router.put('/plans/:planId/submit', ...pgOnly, async (req, res) => {
  
    const plan = await IndividualPlan.findOne({ where: { id: req.params.planId, userId: req.user.id } });
    if (!plan) return res.status(404).json({ error: 'План не найден' });
    if (plan.status !== 'draft') {
      return res.status(400).json({ error: 'Отправить можно только черновик' });
    }
    plan.status = 'submitted';
    await plan.save();
    await writeAudit(req.user.id, 'plan_submit', 'IndividualPlan', plan.id, {});
    const full = await IndividualPlan.findByPk(plan.id, {
      include: [{ model: PlanItem, as: 'items' }]
    });
    res.json(full);
  
});

router.post('/plan-items', ...pgOnly, async (req, res) => {
  
    const { planId, title, orderIdx, dueDate, notes } = req.body;
    if (!planId || !title) return res.status(400).json({ error: 'Укажите план и название пункта' });
    const plan = await IndividualPlan.findOne({ where: { id: planId, userId: req.user.id } });
    if (!plan) return res.status(404).json({ error: 'План не найден' });
    if (!['draft', 'rejected'].includes(plan.status)) {
      return res.status(400).json({ error: 'Пункты можно добавлять только в черновик или после возврата' });
    }
    const item = await PlanItem.create({
      planId: plan.id,
      title: String(title).trim(),
      orderIdx: orderIdx != null ? parseInt(orderIdx, 10) : 0,
      dueDate: dueDate || null,
      notes: notes || null
    });
    res.status(201).json(item);
  
});

router.put('/plan-items/:id', ...pgOnly, async (req, res) => {
  
    const item = await PlanItem.findByPk(req.params.id, { include: [{ model: IndividualPlan, as: 'plan' }] });
    if (!item || !item.plan || item.plan.userId !== req.user.id) {
      return res.status(404).json({ error: 'Не найдено' });
    }
    if (!['draft', 'rejected'].includes(item.plan.status)) {
      return res.status(400).json({ error: 'Редактирование пункта недоступно' });
    }
    const { title, orderIdx, dueDate, notes, completedAt } = req.body;
    if (title !== undefined) item.title = String(title).trim();
    if (orderIdx !== undefined) item.orderIdx = parseInt(orderIdx, 10);
    if (dueDate !== undefined) item.dueDate = dueDate;
    if (notes !== undefined) item.notes = notes;
    if (completedAt !== undefined) item.completedAt = completedAt;
    await item.save();
    res.json(item);
  
});

router.delete('/plan-items/:id', ...pgOnly, async (req, res) => {
  
    const item = await PlanItem.findByPk(req.params.id, { include: [{ model: IndividualPlan, as: 'plan' }] });
    if (!item || !item.plan || item.plan.userId !== req.user.id) {
      return res.status(404).json({ error: 'Не найдено' });
    }
    if (!['draft', 'rejected'].includes(item.plan.status)) {
      return res.status(400).json({ error: 'Удаление недоступно' });
    }
    await item.destroy();
    res.status(204).end();
  
});

router.post('/topics', ...pgOnly, async (req, res) => {
  
    const { title } = req.body;
    if (!title || String(title).trim() === '') {
      return res.status(400).json({ error: 'Укажите тему' });
    }
    const t = await DissertationTopic.create({
      userId: req.user.id,
      title: String(title).trim(),
      status: 'draft'
    });
    res.status(201).json(t);
  
});

router.put('/topics/:id', ...pgOnly, async (req, res) => {
  
    const t = await DissertationTopic.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!t) return res.status(404).json({ error: 'Не найдено' });
    const { title, status } = req.body;
    if (title !== undefined && String(title).trim() !== t.title) {
      if (t.status === 'approved') {
        await DissertationTopicHistory.create({
          userId: req.user.id,
          title: t.title,
          status: t.status,
          note: 'Предыдущая утверждённая тема при смене формулировки',
          changedById: req.user.id
        });
        t.title = String(title).trim();
        t.status = 'draft';
        t.rejectReason = null;
      } else if (['draft', 'submitted', 'rejected'].includes(t.status)) {
        t.title = String(title).trim();
      } else {
        return res.status(400).json({ error: 'Нельзя изменить тему в текущем статусе' });
      }
    }
    if (status !== undefined && ['draft', 'submitted'].includes(status)) {
      if (t.status === 'draft' || t.status === 'rejected') t.status = status;
    }
    await t.save();
    res.json(t);
  
});

router.post('/plans', ...pgOnly, async (req, res) => {
  
    const { academicYear } = req.body;
    if (!academicYear) return res.status(400).json({ error: 'Укажите учебный год' });
    const plan = await IndividualPlan.create({
      userId: req.user.id,
      academicYear: String(academicYear).trim(),
      status: 'draft'
    });
    res.status(201).json(plan);
  
});

router.get('/topic-history', ...pgOnly, async (req, res) => {
  
    const rows = await DissertationTopicHistory.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
      include: [{ model: User, as: 'changedBy', attributes: ['id', 'fullName'] }]
    });
    res.json(rows);
  
});

router.get('/plan', ...pgOnly, async (req, res) => {
  
    const plans = await IndividualPlan.findAll({
      where: { userId: req.user.id },
      include: [{ model: PlanItem, as: 'items' }],
      order: [['academicYear', 'DESC']]
    });
    res.json(plans);
  
});

router.get('/topics', ...pgOnly, async (req, res) => {
  
    const topics = await DissertationTopic.findAll({
      where: { userId: req.user.id },
      order: [['updatedAt', 'DESC']]
    });
    res.json(topics);
  
});

module.exports = router;
