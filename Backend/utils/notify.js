const { Notification } = require('../models');

async function notifyUser(userId, title, body, link) {
  return Notification.create({
    userId,
    title,
    body: body || '',
    link: link || null,
    readAt: null
  });
}

module.exports = { notifyUser };
