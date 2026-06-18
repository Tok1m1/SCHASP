const db = require('../models');

const GROUP_SPECS = [
  { name: 'Аспирантура 2024-1', postgraduates: 2 },
  { name: 'Аспирантура 2024-2', postgraduates: 3 },
  { name: 'Аспирантура 2024-3', postgraduates: 3 },
];

const SCHEDULE_START = '2026-06-09';
const SCHEDULE_END = '2026-06-29';

const TIMES = ['09:00 – 10:35', '10:45 – 12:20', '12:40 – 14:15'];
const AUDITORIUMS = ['Ауд. 210', 'Ауд. 211', 'Лаб. 304', 'Лаб. 305', 'Науч. зал 112', 'Коллоквиум 405'];
const SUBJECTS = [
  'Методология диссертационного исследования',
  'Академическое письмо',
  'Научный семинар',
  'Педагогическая практика',
  'Анализ данных в исследовании',
  'Философия и история науки',
];
const SUPERVISOR_LESSON = 'Консультация научного руководителя по подготовке диссертации';
const SUPERVISOR_ROOM = 'Каб. научного руководителя';

function addDays(iso, days) {
  const d = new Date(`${iso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function weekday(iso) {
  return new Date(`${iso}T12:00:00.000Z`).getUTCDay();
}

function pick(arr, index) {
  return arr[index % arr.length];
}

function lessonsPerWeekday(day, groupIndex) {
  if (day === 5) return 1;
  if (day === 0 || day === 4) return 0;
  return (day + groupIndex) % 2 === 0 ? 3 : 2;
}

async function main() {
  console.log('Sync DB (force)...');
  await db.sequelize.sync({ force: true });

  console.log('Groups...');
  const groups = await Promise.all(GROUP_SPECS.map((g) => db.Group.create({ name: g.name })));

  console.log('Users...');
  const admin = await db.User.create({
    login: 'admin1',
    password: 'admin123',
    fullName: 'Администратор Системы',
    role: 'admin',
    email: 'admin@example.edu',
  });

  const professors = await Promise.all([
    db.User.create({ login: 'professor1', password: 'password123', fullName: 'Иванов Пётр Сергеевич', role: 'professor' }),
    db.User.create({ login: 'professor2', password: 'password123', fullName: 'Смирнова Анна Викторовна', role: 'professor' }),
    db.User.create({ login: 'professor3', password: 'password123', fullName: 'Кузнецов Дмитрий Олегович', role: 'professor' }),
  ]);

  const postgraduates = [];
  let pgIdx = 1;
  for (let gi = 0; gi < groups.length; gi += 1) {
    const g = groups[gi];
    const count = GROUP_SPECS[gi].postgraduates;
    for (let i = 0; i < count; i += 1) {
      const u = await db.User.create({
        login: `postgraduate${pgIdx}`,
        password: 'password123',
        fullName: `Аспирант ${g.name} №${i + 1}`,
        role: 'postgraduate',
        groupId: g.id,
        groupName: g.name,
      });
      postgraduates.push(u);
      pgIdx += 1;
    }
  }

  console.log('Lessons (09.06–29.06.2026, четверг свободен, пятница — консультация)...');
  const lessons = [];

  for (let date = SCHEDULE_START; date <= SCHEDULE_END; date = addDays(date, 1)) {
    const day = weekday(date);

    for (let gi = 0; gi < groups.length; gi += 1) {
      const group = groups[gi];
      const count = lessonsPerWeekday(day, gi);
      if (count === 0) continue;

      for (let li = 0; li < count; li += 1) {
        const isFriday = day === 5;
        const teacher = isFriday ? professors[gi % professors.length] : professors[(gi + li) % professors.length];
        const dayNum = Number(date.slice(8, 10));
        lessons.push(await db.Lesson.create({
          groupId: group.id,
          teacherId: teacher.id,
          date,
          time: TIMES[li % TIMES.length],
          subject: isFriday ? SUPERVISOR_LESSON : pick(SUBJECTS, gi + li + dayNum),
          auditorium: isFriday ? SUPERVISOR_ROOM : pick(AUDITORIUMS, gi + li),
        }));
      }
    }
  }

  console.log('lessons:', lessons.length);

  console.log('Attendance + lesson grades...');
  const attendanceRows = [];
  const gradeRows = [];
  const gradeValues = ['5', '4', '3', 'зачёт', 'н/я'];

  for (const lesson of lessons) {
    const students = postgraduates.filter((p) => p.groupId === lesson.groupId);
    for (const pg of students) {
      const status = (pg.id + lesson.id) % 7 === 0 ? 'absent' : 'present';
      attendanceRows.push({
        lessonId: lesson.id,
        postgraduateId: pg.id,
        status,
        comment: status === 'absent' ? 'Уважительная причина (демо)' : null,
        markedById: lesson.teacherId,
      });
    }

    const gradesCount = Math.min(students.length, students.length <= 2 ? 2 : 3);
    const shuffled = [...students].sort((a, b) => ((a.id + lesson.id) % 5) - ((b.id + lesson.id) % 5));
    for (const pg of shuffled.slice(0, gradesCount)) {
      const gradeValue = gradeValues[(pg.id + lesson.id) % gradeValues.length];
      gradeRows.push({
        lessonId: lesson.id,
        postgraduateId: pg.id,
        grade: gradeValue,
        comment: gradeValue === '3' ? 'Требуется доработка (демо)' : 'Хорошо (демо)',
        markedById: lesson.teacherId,
      });
    }
  }

  await db.Attendance.bulkCreate(attendanceRows);
  await db.LessonGrade.bulkCreate(gradeRows);

  console.log('attendance:', attendanceRows.length);
  console.log('lesson_grades:', gradeRows.length);

  console.log('Attestations + supervisions...');
  await db.Supervision.bulkCreate([
    { postgraduateId: postgraduates[0].id, supervisorId: professors[0].id, supervisionKind: 'primary', startedAt: '2025-09-01', isActive: true },
    { postgraduateId: postgraduates[1].id, supervisorId: professors[0].id, supervisionKind: 'primary', startedAt: '2025-09-01', isActive: true },
    { postgraduateId: postgraduates[2].id, supervisorId: professors[1].id, supervisionKind: 'primary', startedAt: '2025-09-01', isActive: true },
    { postgraduateId: postgraduates[3].id, supervisorId: professors[1].id, supervisionKind: 'primary', startedAt: '2025-09-01', isActive: true },
  ]);
  await db.Attestation.bulkCreate([
    {
      userId: postgraduates[0].id,
      periodLabel: 'Кандидатский экзамен по специальности',
      decision: 'passed',
      attestedAt: '2025-12-15',
      notes: 'Демо-запись',
    },
    {
      userId: postgraduates[1].id,
      periodLabel: 'Кандидатский экзамен по иностранному языку',
      decision: 'failed',
      attestedAt: '2026-01-20',
      notes: 'Пересдача весной',
    },
  ]);

  console.log('\nAccounts:');
  console.log(' admin: admin1 / admin123');
  console.log(' professors: professor1..professor3 / password123');
  console.log(' postgraduates: postgraduate1..postgraduate8 / password123');

  await db.sequelize.close();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('Seed failed:', err);
  try {
    await db.sequelize.close();
  } catch {
    // ignore
  }
  process.exit(1);
});
