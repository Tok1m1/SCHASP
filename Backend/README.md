# Backend - Система личных кабинетов

Backend сервер на Express.js с Sequelize ORM и PostgreSQL.

## Установка

1. Установите зависимости:
```bash
npm install
```

2. Настройте базу данных в `config/database.js` или через переменные окружения (`.env`):
   - `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_HOST`, `DB_PORT`

3. Создайте базу данных в PostgreSQL:
```sql
CREATE DATABASE schedule_db_backup1;
```

## Запуск

### Режим разработки (с автоперезагрузкой):
```bash
npm run dev
```

### Продакшн режим:
```bash
npm start
```

Сервер запустится на порту 3000.

## Демо-данные

Полный сброс и заполнение БД (3 группы, 8 аспирантов, расписание на июнь 2026, demo-аттестации):

```bash
npm run seed
```

**Учётные записи после seed:**
- Администратор: `admin1` / `admin123`
- Профессора: `professor1`..`professor3` / `password123`
- Аспиранты: `postgraduate1`..`postgraduate8` / `password123`

**Внимание:** `npm run seed` пересоздаёт все таблицы и удаляет существующие данные.

## API Endpoints (основные)

### Авторизация
- `POST /api/auth/login` — вход

### Профиль
- `GET /api/profile/me` — текущий пользователь
- `PUT /api/profile/me` — обновление профиля

### Расписание (таблица `lessons`)
- `GET /api/schedule?from=&to=` — список занятий с фильтром по датам
- `POST /api/schedule` — создать занятие (admin)
- `POST /api/schedule/import` — импорт CSV (admin)

### Журнал (таблицы `attendance`, `lesson_grades`)
- `GET /api/journal/lessons?date=` — занятия на дату
- `GET /api/journal/entry?lessonId=` — посещаемость и оценки по занятию
- `POST /api/journal/entry` — сохранить журнал
- `GET /api/journal/my-attendance`, `GET /api/journal/my-grades` — для аспиранта

### Администрирование (`/api/admin`, роль admin)

**Пользователи**
- `GET /api/admin/users`, `GET /api/admin/users/:id`
- `POST /api/admin/users`, `PUT /api/admin/users/:id`, `DELETE /api/admin/users/:id`
- При указании `groupId` автоматически синхронизируется `groupName`

**Группы**
- `GET /api/admin/groups` — список с `_count.members` и `_count.lessons`
- `GET /api/admin/groups/:id`
- `POST /api/admin/groups` — `{ name, description? }`
- `PUT /api/admin/groups/:id`
- `DELETE /api/admin/groups/:id` — запрещено, если есть пользователи или занятия

**Аттестации**
- `GET /api/admin/attestations?userId=`
- `POST /api/admin/attestations` — `{ userId, periodLabel, decision?, notes?, attestedAt? }`
- `PUT /api/admin/attestations/:id`
- `DELETE /api/admin/attestations/:id`

**Журнал аудита**
- `GET /api/admin/audit-logs?limit=&offset=&actorId=&entityType=&action=`

**Прочее**
- `GET /api/admin/messages`, `DELETE /api/admin/messages/:id`
- `POST /api/admin/supervisions`, `PATCH /api/admin/supervisions/:id`
- `GET /api/admin/timesheet/export?year=&month=`

### Научный руководитель (`/api/supervisor`, роль professor)

**Аттестации**
- `POST /api/supervisor/attestations` — `{ postgraduateId, periodLabel, ... }`
- `PATCH /api/supervisor/attestations/:id`
- `DELETE /api/supervisor/attestations/:id`

## Структура проекта

```
Backend/
├── config/database.js
├── models/
│   ├── index.js
│   ├── User.js
│   ├── Group.js
│   ├── Lesson.js
│   ├── LessonGrade.js
│   ├── Attendance.js
│   ├── Attestation.js
│   ├── AuditLog.js
│   └── ...
├── routes/
│   ├── schedule.js
│   ├── journal.js
│   ├── admin.js
│   ├── supervisor.js
│   └── ...
├── scripts/
│   ├── seed-demo.js
│   └── drop-legacy-tables.sql
└── server.js
```

## Зачистка неиспользуемых таблиц

После обновления кода и **backup БД** удалите устаревшие таблицы:

```bash
npm run db:drop-legacy
```

Скрипт удаляет:
- `schedules` (заменена на `lessons`)
- `grades` (заменена на `lesson_grades`)
- `subjects` (справочник не использовался; предмет хранится в `lessons.subject`)

Порядок на prod/staging: backup → deploy нового кода → `npm run db:drop-legacy`.
