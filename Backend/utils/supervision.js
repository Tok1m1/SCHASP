const { Supervision } = require('../models');

async function userSupervisesPostgraduate(supervisorId, postgraduateId) {
  const row = await Supervision.findOne({
    where: { supervisorId, postgraduateId, isActive: true }
  });
  return !!row;
}

module.exports = { userSupervisesPostgraduate };
