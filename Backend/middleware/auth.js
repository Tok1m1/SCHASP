const { User } = require('../models');
const { verifyToken } = require('../config/jwt');

function extractBearerToken(req) {
  const h = req.headers.authorization;
  if (!h || typeof h !== 'string') return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

const requireAuth = async (req, res, next) => {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Требуется авторизация. Укажите заголовок Authorization: Bearer <токен>' });
    }
    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      return res.status(401).json({ error: 'Недействительный или просроченный токен' });
    }
    const userId = payload.sub;
    if (!userId) {
      return res.status(401).json({ error: 'Некорректный токен' });
    }
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Ошибка авторизации: ' + error.message });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      return next();
    }
    try {
      const payload = verifyToken(token);
      const userId = payload.sub;
      if (userId) {
        const user = await User.findByPk(userId);
        if (user) req.user = user;
      }
    } catch {
      // игнорируем невалидный токен для optional
    }
    next();
  } catch (error) {
    next();
  }
};

/** @param {...string} roles */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Недостаточно прав для этой операции' });
    }
    next();
  };
}

module.exports = {
  requireAuth,
  optionalAuth,
  requireRole,
  extractBearerToken
};
