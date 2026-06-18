const ATTESTATION_DECISIONS = ['passed', 'failed', 'rescheduled', 'pending'];

const ATTESTATION_DECISION_LABELS = {
  passed: 'Сдан',
  failed: 'Не сдан',
  rescheduled: 'Перенесён',
  pending: 'Ожидает',
};

function isValidAttestationDecision(value) {
  return value == null || value === '' || ATTESTATION_DECISIONS.includes(value);
}

function normalizeAttestationDecision(value) {
  if (value == null || value === '') return null;
  const v = String(value).trim();
  if (ATTESTATION_DECISIONS.includes(v)) return v;
  const legacy = {
    сдан: 'passed',
    'не сдан': 'failed',
    перенесён: 'rescheduled',
    перенесен: 'rescheduled',
    ожидает: 'pending',
  };
  return legacy[v.toLowerCase()] || null;
}

module.exports = {
  ATTESTATION_DECISIONS,
  ATTESTATION_DECISION_LABELS,
  isValidAttestationDecision,
  normalizeAttestationDecision,
};
