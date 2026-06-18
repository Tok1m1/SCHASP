export const ROLE_LABELS = {
  admin: "Администратор",
  postgraduate: "Аспирант",
  professor: "Профессор",
};

export function getRoleLabel(role) {
  return ROLE_LABELS[role] || role;
}

export const ATTESTATION_DECISION_LABELS = {
  passed: "Сдан",
  failed: "Не сдан",
  rescheduled: "Перенесён",
  pending: "Ожидает",
};

export const ATTESTATION_DECISION_OPTIONS = Object.entries(ATTESTATION_DECISION_LABELS).map(
  ([value, label]) => ({ value, label })
);

export function getAttestationDecisionLabel(decision) {
  return ATTESTATION_DECISION_LABELS[decision] || decision || "—";
}

export const ATTENDANCE_STATUS_LABELS = {
  present: "Присутствовал",
  absent: "Отсутствовал",
  unknown: "Не отмечено",
};

export function getAttendanceStatusLabel(status) {
  return ATTENDANCE_STATUS_LABELS[status] || status;
}

export const JOURNAL_ATTENDANCE_COLUMNS = ["date", "time", "subject", "teacher", "status"];

export const JOURNAL_ATTENDANCE_COLUMN_LABELS = {
  date: "Дата",
  time: "Время",
  subject: "Предмет",
  teacher: "Преподаватель",
  status: "Статус",
};

export const JOURNAL_GRADE_COLUMNS = ["date", "subject", "teacher", "grade"];

export const JOURNAL_GRADE_COLUMN_LABELS = {
  date: "Дата",
  subject: "Предмет",
  teacher: "Преподаватель",
  grade: "Оценка",
};
