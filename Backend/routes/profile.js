const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getRoleTitle } = require('../utils/roles');

// GET /api/profile/me - Получить текущего пользователя
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const userData = user.toSafeJSON();
    userData.roleTitle = getRoleTitle(user.role);
    
    res.json(userData);
  } catch (error) {
    console.error('Ошибка получения профиля:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// PUT /api/profile/me - Обновить профиль
router.put('/me', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { fullName, groupName, email, phone, oldPassword, newPassword } = req.body;

    // Обновляем основные данные
    if (fullName !== undefined) user.fullName = fullName;
    if (groupName !== undefined && user.role === 'postgraduate') user.groupName = groupName;
    if (email !== undefined) user.email = email;
    if (phone !== undefined) user.phone = phone;

    // Обновляем пароль, если указан
    if (newPassword) {
      if (!oldPassword) {
        return res.status(400).json({ error: 'Требуется текущий пароль для смены' });
      }

      const isValidPassword = await user.checkPassword(oldPassword);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Неверный текущий пароль' });
      }

      user.password = newPassword; // Хук в модели автоматически захеширует
    }

    await user.save();

    const userData = user.toSafeJSON();
    userData.roleTitle = getRoleTitle(user.role);

    res.json(userData);
  } catch (error) {
    console.error('Ошибка обновления профиля:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;

