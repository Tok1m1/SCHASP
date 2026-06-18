const HEADER_ALIASES = {
  group: 'group',
  gruppa: 'group',
  группа: 'group',
  date: 'date',
  data: 'date',
  дата: 'date',
  time: 'time',
  vremya: 'time',
  время: 'time',
  subject: 'subject',
  zanyatie: 'subject',
  занятие: 'subject',
  predmet: 'subject',
  teacher: 'teacher',
  prepodavatel: 'teacher',
  преподаватель: 'teacher',
  auditorium: 'auditorium',
  auditoriya: 'auditorium',
  аудитория: 'auditorium',
};

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\ufeff/g, '')
    .replace(/\s+/g, '');
}

function mapHeader(value) {
  const key = normalizeHeader(value);
  return HEADER_ALIASES[key] || null;
}

function detectDelimiter(line) {
  let commas = 0;
  let semicolons = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes) {
      if (c === ',') commas += 1;
      if (c === ';') semicolons += 1;
    }
  }
  return semicolons >= commas ? ';' : ',';
}

function parseCsvLine(line, delimiter) {
  const result = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }

  result.push(cur.trim());
  return result;
}

function normalizeDate(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const ruMatch = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (ruMatch) {
    const [, d, m, y] = ruMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  return null;
}

function parseScheduleCsv(buffer) {
  let text = buffer.toString('utf8');
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return { rows: [], errors: [{ line: 0, message: 'Файл пуст' }] };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headerCells = parseCsvLine(lines[0], delimiter);
  const columnMap = {};

  headerCells.forEach((cell, index) => {
    const field = mapHeader(cell);
    if (field && columnMap[field] == null) {
      columnMap[field] = index;
    }
  });

  const required = ['group', 'date', 'time', 'subject', 'teacher'];
  const missing = required.filter((field) => columnMap[field] == null);
  if (missing.length) {
    return {
      rows: [],
      errors: [{
        line: 1,
        message: `Не найдены колонки: ${missing.join(', ')}. Ожидаются: Группа, Дата, Время, Занятие, Преподаватель, Аудитория`,
      }],
    };
  }

  const rows = [];
  const errors = [];

  for (let i = 1; i < lines.length; i += 1) {
    const lineNo = i + 1;
    const cells = parseCsvLine(lines[i], delimiter);
    const get = (field) => {
      const idx = columnMap[field];
      return idx == null ? '' : String(cells[idx] ?? '').trim();
    };

    const groupName = get('group');
    const dateRaw = get('date');
    const time = get('time');
    const subject = get('subject');
    const teacherName = get('teacher');
    const auditorium = get('auditorium') || null;

    if (!groupName && !dateRaw && !time && !subject && !teacherName) {
      continue;
    }

    const date = normalizeDate(dateRaw);
    if (!groupName) {
      errors.push({ line: lineNo, message: 'Не указана группа' });
      continue;
    }
    if (!date) {
      errors.push({ line: lineNo, message: `Некорректная дата: "${dateRaw}"` });
      continue;
    }
    if (!time) {
      errors.push({ line: lineNo, message: 'Не указано время' });
      continue;
    }
    if (!subject) {
      errors.push({ line: lineNo, message: 'Не указано занятие' });
      continue;
    }
    if (!teacherName) {
      errors.push({ line: lineNo, message: 'Не указан преподаватель' });
      continue;
    }

    rows.push({ line: lineNo, groupName, date, time, subject, teacherName, auditorium });
  }

  return { rows, errors };
}

module.exports = { parseScheduleCsv, normalizeDate };
