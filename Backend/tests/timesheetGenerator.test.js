const {
  ACADEMIC_HOURS_PER_LESSON,
  getLessonCredit,
  aggregateTimesheetHours,
  sumDays,
  dayOfMonthFromDate,
  getMonthBounds,
} = require('../utils/timesheetGenerator');

describe('timesheetGenerator', () => {
  test('getMonthBounds returns valid range', () => {
    const bounds = getMonthBounds(2025, 10);
    expect(bounds.start).toBe('2025-10-01');
    expect(bounds.end).toBe('2025-10-31');
    expect(bounds.lastDay).toBe(31);
  });

  test('dayOfMonthFromDate parses day', () => {
    expect(dayOfMonthFromDate('2025-10-15')).toBe(15);
  });

  test('normal lesson credits scheduled teacher with 2 hours', () => {
    expect(getLessonCredit({ status: 'normal', teacherId: 1 })).toEqual({
      professorId: 1,
      hours: ACADEMIC_HOURS_PER_LESSON,
    });
  });

  test('cancelled lesson gives no credit', () => {
    expect(getLessonCredit({ status: 'cancelled', teacherId: 1 })).toBeNull();
  });

  test('substituted lesson credits substitute teacher', () => {
    expect(getLessonCredit({
      status: 'substituted',
      teacherId: 1,
      substituteTeacherId: 2,
    })).toEqual({
      professorId: 2,
      hours: ACADEMIC_HOURS_PER_LESSON,
    });
  });

  test('aggregates multiple lessons per day', () => {
    const usersById = new Map([
      [1, { id: 1, fullName: 'Prof A' }],
    ]);
    const lessons = [
      { status: 'normal', teacherId: 1, date: '2025-10-05' },
      { status: 'normal', teacherId: 1, date: '2025-10-05' },
      { status: 'cancelled', teacherId: 1, date: '2025-10-06' },
    ];
    const agg = aggregateTimesheetHours(lessons, usersById);
    const entry = agg.get(1);
    expect(entry.days.get(5)).toBe(4);
    expect(entry.days.get(6)).toBeUndefined();
    expect(sumDays(entry.days, 1, 15)).toBe(4);
  });
});
