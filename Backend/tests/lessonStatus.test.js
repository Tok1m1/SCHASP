const { applyLessonStatusFields, normalizeLessonStatus } = require('../utils/lessonStatus');

describe('lessonStatus', () => {
  test('normalizeLessonStatus accepts known values', () => {
    expect(normalizeLessonStatus('cancelled')).toBe('cancelled');
    expect(normalizeLessonStatus('bad')).toBeNull();
  });

  test('substituted requires substitute teacher', () => {
    const lesson = { status: 'normal', teacherId: 1, substituteTeacherId: null };
    const result = applyLessonStatusFields(lesson, { status: 'substituted' });
    expect(result.error).toMatch(/заменяющего/i);
  });

  test('substituted cannot equal scheduled teacher', () => {
    const lesson = { status: 'normal', teacherId: 1, substituteTeacherId: null };
    const result = applyLessonStatusFields(lesson, { status: 'substituted', substituteTeacherId: 1, teacherId: 1 });
    expect(result.error).toMatch(/совпадать/i);
  });

  test('cancelled clears substituteTeacherId', () => {
    const lesson = { status: 'substituted', teacherId: 1, substituteTeacherId: 2 };
    const result = applyLessonStatusFields(lesson, { status: 'cancelled' });
    expect(result.ok).toBe(true);
    expect(lesson.status).toBe('cancelled');
    expect(lesson.substituteTeacherId).toBeNull();
  });
});
