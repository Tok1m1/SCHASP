const path = require('path');
const ExcelJS = require('exceljs');
const { Op } = require('sequelize');
const { Lesson, User } = require('../models');

const ACADEMIC_HOURS_PER_LESSON = 2.0;
const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'timesheet-template.xlsx');
const DATA_START_ROW = 23;

/** Колонки дней месяца (строка 15 шаблона ОКУД 0504421). */
const DAY_COLUMNS = {
  1: 'AD', 2: 'AF', 3: 'AH', 4: 'AJ', 5: 'AL', 6: 'AN', 7: 'AP', 8: 'AR', 9: 'AT', 10: 'AV',
  11: 'AX', 12: 'AZ', 13: 'BB', 14: 'BD', 15: 'BF', 16: 'BL', 17: 'BN', 18: 'BP', 19: 'BR', 20: 'BT',
  21: 'BV', 22: 'BX', 23: 'BZ', 24: 'CB', 25: 'CD', 26: 'CF', 27: 'CH', 28: 'CJ', 29: 'CL', 30: 'CN', 31: 'CP',
};

const HALF_TOTAL_COL = 'BH';
const FULL_TOTAL_COL = 'CR';

const MONTH_NAMES_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

function getMonthBounds(year, month) {
  const y = Number(year);
  const m = Number(month);
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) {
    return null;
  }
  const lastDay = new Date(y, m, 0).getDate();
  const pad = (n) => String(n).padStart(2, '0');
  return {
    year: y,
    month: m,
    lastDay,
    start: `${y}-${pad(m)}-01`,
    end: `${y}-${pad(m)}-${pad(lastDay)}`,
  };
}

function dayOfMonthFromDate(dateStr) {
  const d = String(dateStr || '').slice(0, 10);
  const day = Number(d.slice(8, 10));
  return Number.isInteger(day) && day >= 1 && day <= 31 ? day : null;
}

function isWeekend(year, month, day) {
  const dow = new Date(year, month - 1, day).getDay();
  return dow === 0 || dow === 6;
}

/**
 * Определяет, кому начислить часы за занятие.
 * @returns {{ professorId: number, hours: number } | null}
 */
function getLessonCredit(lesson) {
  const status = lesson.status || 'normal';
  if (status === 'cancelled') return null;
  if (status === 'substituted') {
    if (!lesson.substituteTeacherId) return null;
    return { professorId: lesson.substituteTeacherId, hours: ACADEMIC_HOURS_PER_LESSON };
  }
  return { professorId: lesson.teacherId, hours: ACADEMIC_HOURS_PER_LESSON };
}

/**
 * Агрегирует часы по профессорам и дням месяца.
 * @returns {Map<number, { user: object, days: Map<number, number> }>}
 */
function aggregateTimesheetHours(lessons, usersById) {
  const byProfessor = new Map();

  for (const lesson of lessons) {
    const credit = getLessonCredit(lesson);
    if (!credit) continue;

    const day = dayOfMonthFromDate(lesson.date);
    if (!day) continue;

    if (!byProfessor.has(credit.professorId)) {
      const user = usersById.get(credit.professorId);
      if (!user) continue;
      byProfessor.set(credit.professorId, { user, days: new Map() });
    }

    const entry = byProfessor.get(credit.professorId);
    const prev = entry.days.get(day) || 0;
    entry.days.set(day, prev + credit.hours);
  }

  return byProfessor;
}

function sumDays(daysMap, fromDay, toDay) {
  let total = 0;
  for (let d = fromDay; d <= toDay; d += 1) {
    total += daysMap.get(d) || 0;
  }
  return total;
}

function formatRuDate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function setCell(sheet, col, row, value) {
  sheet.getCell(`${col}${row}`).value = value;
}

function clearEmployeeBlock(sheet, fromRow, toRow) {
  const cols = ['A', 'C', 'O', 'W', ...Object.values(DAY_COLUMNS), HALF_TOTAL_COL, FULL_TOTAL_COL];
  for (let r = fromRow; r <= toRow; r += 1) {
    cols.forEach((col) => {
      sheet.getCell(`${col}${r}`).value = null;
    });
  }
}

function updateHeader(sheet, bounds) {
  const monthName = MONTH_NAMES_GENITIVE[bounds.month - 1];
  const today = formatRuDate(new Date());

  setCell(sheet, 'AK', 8, bounds.lastDay);
  setCell(sheet, 'AO', 8, monthName);
  setCell(sheet, 'CJ', 7, today);
  setCell(sheet, 'CJ', 12, today);
}

async function generateTimesheetBuffer(year, month) {
  const bounds = getMonthBounds(year, month);
  if (!bounds) {
    throw new Error('Некорректный год или месяц');
  }

  const lessons = await Lesson.findAll({
    where: {
      date: { [Op.gte]: bounds.start, [Op.lte]: bounds.end },
    },
    attributes: ['id', 'teacherId', 'substituteTeacherId', 'date', 'status'],
  });

  const professorIds = new Set();
  for (const lesson of lessons) {
    const credit = getLessonCredit(lesson);
    if (credit) professorIds.add(credit.professorId);
  }

  if (!professorIds.size) {
    return null;
  }

  const professors = await User.findAll({
    where: {
      id: { [Op.in]: [...professorIds] },
      role: 'professor',
    },
    attributes: ['id', 'fullName', 'tabNumber', 'position'],
    order: [['fullName', 'ASC']],
  });

  const usersById = new Map(professors.map((u) => [u.id, u]));
  const aggregated = aggregateTimesheetHours(lessons, usersById);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(TEMPLATE_PATH);
  const sheet = workbook.getWorksheet(1) || workbook.worksheets[0];

  updateHeader(sheet, bounds);
  clearEmployeeBlock(sheet, DATA_START_ROW, DATA_START_ROW + 60);

  let row = DATA_START_ROW;
  let index = 0;

  for (const prof of professors) {
    const data = aggregated.get(prof.id);
    if (!data) continue;

    const { days } = data;
    const halfTotal = sumDays(days, 1, Math.min(15, bounds.lastDay));
    const fullTotal = sumDays(days, 1, bounds.lastDay);
    if (fullTotal <= 0) continue;

    index += 1;
    const hoursRow = row;
    const codesRow = row + 1;

    setCell(sheet, 'A', hoursRow, index);
    setCell(sheet, 'C', hoursRow, prof.fullName || '');
    setCell(sheet, 'O', hoursRow, prof.tabNumber || '');
    setCell(sheet, 'W', hoursRow, prof.position || '');

    for (let day = 1; day <= bounds.lastDay; day += 1) {
      const col = DAY_COLUMNS[day];
      if (!col) continue;
      const hours = days.get(day) || 0;
      if (hours > 0) {
        setCell(sheet, col, hoursRow, hours);
        setCell(sheet, col, codesRow, 'Ф');
      } else if (isWeekend(bounds.year, bounds.month, day)) {
        setCell(sheet, col, codesRow, 'В');
      }
    }

    setCell(sheet, HALF_TOTAL_COL, hoursRow, halfTotal);
    setCell(sheet, FULL_TOTAL_COL, hoursRow, fullTotal);

    row += 2;
  }

  if (index === 0) {
    return null;
  }

  return workbook.xlsx.writeBuffer();
}

function buildTimesheetFilename(year, month) {
  const bounds = getMonthBounds(year, month);
  const monthName = bounds ? MONTH_NAMES_GENITIVE[bounds.month - 1] : 'месяца';
  const lastDay = bounds ? bounds.lastDay : 31;
  return `Табель 1-${lastDay} ${monthName} ${year}.xlsx`;
}

module.exports = {
  ACADEMIC_HOURS_PER_LESSON,
  getMonthBounds,
  getLessonCredit,
  aggregateTimesheetHours,
  sumDays,
  dayOfMonthFromDate,
  generateTimesheetBuffer,
  buildTimesheetFilename,
};
