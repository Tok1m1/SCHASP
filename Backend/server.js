require('dotenv').config();
require('express-async-errors');
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./models');
const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

function resolveFrontendPath() {
  const candidates = [
    process.env.FRONTEND_PATH && path.resolve(__dirname, process.env.FRONTEND_PATH),
    path.resolve(__dirname, '../Frontend'),
    path.resolve(__dirname, '../frontend'),
    path.resolve(__dirname, '../Frontend/build'),
    path.resolve(__dirname, '../frontend/build')
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(path.join(candidate, 'index.html'))) || null;
}

const staticPath = resolveFrontendPath();
const defaultCorsOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`
];
const configuredOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)
  : defaultCorsOrigins;
const allowedOrigins = new Set(configuredOrigins);

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true); // Allow non-browser clients (like curl, mobile)
    if (allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});
app.get('/api', (req, res) => {
  res.json({
    message: 'API системы личных кабинетов',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      profile: '/api/profile',
      schedule: '/api/schedule',
      messages: '/api/messages',
      admin: '/api/admin',
      journal: '/api/journal',
      postgraduate: '/api/postgraduate',
      supervisor: '/api/supervisor',
      notifications: '/api/notifications'
    }
  });
});
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    staticPath: staticPath || null
  });
});
app.use('/api/auth', require('./routes/auth'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/schedule', require('./routes/schedule'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/journal', require('./routes/journal'));
app.use('/api/postgraduate', require('./routes/postgraduate'));
app.use('/api/supervisor', require('./routes/supervisor'));
app.use('/api/notifications', require('./routes/notifications'));
if (staticPath) {
  app.use(express.static(staticPath));
}
app.use((err, req, res, next) => {
  console.error('Глобальная ошибка:', err);
  
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Ошибка валидации данных',
      details: err.flatten().fieldErrors
    });
  }

  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? 'Внутренняя ошибка сервера' : err.message
  });
});
app.use((req, res) => {
  if (!req.path.startsWith('/api')) {
    if (!staticPath) {
      return res.status(503).json({
        error: 'Frontend build not found. Build frontend and set FRONTEND_PATH if needed.'
      });
    }
    const indexPath = path.join(staticPath, 'index.html');
    res.status(200).sendFile(indexPath);
  } else {
    res.status(404).json({
      error: 'Маршрут не найден',
      path: req.path,
      method: req.method
    });
  }
});
async function startServer() {
  try {
    await db.sync(false);
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Сервер запущен на порту ${PORT}`);
      console.log(`📡 API доступен по адресу: http://localhost:${PORT}/index.html`);
      console.log(`📁 Static frontend path: ${staticPath || 'не найден'}`);
    });
  } catch (error) {
    console.error('❌ Ошибка запуска сервера:', error);
    process.exit(1);
  }
}
startServer();
process.on('SIGTERM', async () => {
  console.log('SIGTERM получен, закрываем соединения...');
  await db.sequelize.close();
  process.exit(0);
});