const { AuditLog } = require('../models');

async function writeAudit(actorId, action, entityType, entityId, details) {
  try {
    await AuditLog.create({
      actorId: actorId || null,
      action,
      entityType,
      entityId: entityId ?? null,
      details: details ? (typeof details === 'string' ? details : JSON.stringify(details)) : null
    });
  } catch (e) {
    console.error('audit log failed:', e.message);
  }
}

module.exports = { writeAudit };
