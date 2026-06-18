const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { Notification } = require('../models');

router.get('/', requireAuth, async (req, res) => {
  try {
    const list = await Notification.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
      limit: 100
    });
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.patch('/:id/read', requireAuth, async (req, res) => {
  try {
    const n = await Notification.findOne({
      where: { id: req.params.id, userId: req.user.id }
    });
    if (!n) return res.status(404).json({ error: 'Не найдено' });
    n.readAt = new Date();
    await n.save();
    res.json(n);
  } catch (e) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

router.post('/read-all', requireAuth, async (req, res) => {
  try {
    await Notification.update(
      { readAt: new Date() },
      { where: { userId: req.user.id, readAt: null } }
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
