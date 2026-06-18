const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const { User } = require('../models');
const { signToken } = require('../config/jwt');
const { getRoleTitle } = require('../utils/roles');
const { validate } = require('../middleware/validate');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Слишком много попыток входа, пожалуйста, подождите 15 минут' }
});

const loginSchema = z.object({
  login: z.string().min(1, 'Логин обязателен'),
  password: z.string().min(1, 'Пароль обязателен'),
  role: z.enum(['admin', 'postgraduate', 'professor']).optional()
});

router.post('/login', loginLimiter, validate(loginSchema), async (req, res) => {
  const { login, password, role } = req.body;

  const user = await User.findOne({ where: { login } });
  if (!user) {
    const error = new Error('Неверный логин или пароль');
    error.status = 401;
    throw error;
  }

  const isValidPassword = await user.checkPassword(password);
  if (!isValidPassword) {
    const error = new Error('Неверный логин или пароль');
    error.status = 401;
    throw error;
  }

  if (role && user.role !== role) {
    const error = new Error('Неверная роль пользователя');
    error.status = 403;
    throw error;
  }

  const userData = user.toSafeJSON();
  userData.roleTitle = getRoleTitle(user.role);
  const token = signToken(user.id);

  res.json({ token, user: userData });
});

module.exports = router;

