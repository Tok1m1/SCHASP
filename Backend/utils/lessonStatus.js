const LESSON_STATUSES = ['normal', 'cancelled', 'substituted'];

function normalizeLessonStatus(status) {
  const s = String(status || 'normal').trim();
  return LESSON_STATUSES.includes(s) ? s : null;
}

function applyLessonStatusFields(lesson, { status, substituteTeacherId, teacherId }) {
  const nextStatus = status !== undefined ? normalizeLessonStatus(status) : lesson.status || 'normal';
  if (status !== undefined && !nextStatus) {
    return { error: 'Недопустимый статус занятия' };
  }

  const effectiveStatus = nextStatus || 'normal';
  lesson.status = effectiveStatus;

  if (effectiveStatus === 'substituted') {
    const subId = substituteTeacherId != null ? Number(substituteTeacherId) : lesson.substituteTeacherId;
    const ownerId = teacherId != null ? Number(teacherId) : lesson.teacherId;
    if (!subId) {
      return { error: 'Укажите заменяющего преподавателя' };
    }
    if (ownerId && subId === ownerId) {
      return { error: 'Заменяющий преподаватель не может совпадать с штатным' };
    }
    lesson.substituteTeacherId = subId;
  } else {
    lesson.substituteTeacherId = null;
  }

  return { ok: true };
}

module.exports = {
  LESSON_STATUSES,
  normalizeLessonStatus,
  applyLessonStatusFields,
};
