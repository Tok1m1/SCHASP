const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { requireAuth } = require('../middleware/auth');
const { Message, User } = require('../models');
const { writeAudit } = require('../utils/audit');

function getMessagePartnerRole(userRole) {
  const map = {
    postgraduate: 'professor',
    professor: 'postgraduate',
    admin: 'professor'
  };
  return map[userRole] || null;
}

function canExchangeMessages(aRole, bRole) {
  if (aRole === bRole) return false;
  if (
    (aRole === 'postgraduate' && bRole === 'professor') ||
    (aRole === 'professor' && bRole === 'postgraduate')
  ) {
    return true;
  }
  if (aRole === 'admin' && ['postgraduate', 'professor'].includes(bRole)) return true;
  if (bRole === 'admin' && ['postgraduate', 'professor'].includes(aRole)) return true;
  return false;
}

// GET /api/messages/conversations - Получить список диалогов
router.get('/conversations', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    const targetRole = getMessagePartnerRole(userRole);
    if (!targetRole) {
      return res.json([]);
    }

    const allUsers = await User.findAll({
      where: { role: targetRole },
      attributes: ['id', 'fullName', 'login', 'groupName'],
      order: [['fullName', 'ASC']]
    });
    
    // Получаем последние сообщения для каждого пользователя
    const conversations = await Promise.all(allUsers.map(async (user) => {
      const lastMessage = await Message.findOne({
        where: {
          [Op.or]: [
            { senderId: userId, recipientId: user.id },
            { senderId: user.id, recipientId: userId }
          ]
        },
        order: [['createdAt', 'DESC']],
        include: [
          { model: User, as: 'sender', attributes: ['id', 'fullName'] },
          { model: User, as: 'recipient', attributes: ['id', 'fullName'] }
        ]
      });
      
      return {
        userId: user.id,
        fullName: user.fullName,
        login: user.login,
        groupName: user.groupName,
        lastMessage: lastMessage ? {
          id: lastMessage.id,
          text: lastMessage.text,
          topic: lastMessage.topic,
          createdAt: lastMessage.createdAt,
          isRead: lastMessage.isRead,
          senderId: lastMessage.senderId
        } : null
      };
    }));
    
    res.json(conversations);
  } catch (error) {
    console.error('Ошибка получения диалогов:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/messages/:userId - Получить все сообщения с конкретным пользователем
router.get('/:userId', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const otherUserId = parseInt(req.params.userId);
    
    if (isNaN(otherUserId)) {
      return res.status(400).json({ error: 'Неверный ID пользователя' });
    }
    
    // Получаем все сообщения между текущим пользователем и выбранным
    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { senderId: userId, recipientId: otherUserId },
          { senderId: otherUserId, recipientId: userId }
        ]
      },
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'fullName', 'login']
        },
        {
          model: User,
          as: 'recipient',
          attributes: ['id', 'fullName', 'login']
        }
      ],
      order: [['createdAt', 'ASC']]
    });
    
    // Отмечаем сообщения как прочитанные
    await Message.update(
      { isRead: true },
      {
        where: {
          recipientId: userId,
          senderId: otherUserId,
          isRead: false
        }
      }
    );
    
    // Форматируем ответ
    const formattedMessages = messages.map(msg => ({
      id: msg.id,
      topic: msg.topic,
      text: msg.text,
      senderId: msg.senderId,
      recipientId: msg.recipientId,
      sender: msg.sender ? msg.sender.fullName : 'Неизвестно',
      recipient: msg.recipient ? msg.recipient.fullName : 'Неизвестно',
      createdAt: msg.createdAt,
      isRead: msg.isRead
    }));
    
    res.json(formattedMessages);
  } catch (error) {
    console.error('Ошибка получения сообщений:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/messages - Получить сообщения текущего пользователя (для обратной совместимости)
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Получаем входящие сообщения
    const messages = await Message.findAll({
      where: { recipientId: userId },
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'fullName', 'login']
        },
        {
          model: User,
          as: 'recipient',
          attributes: ['id', 'fullName', 'login']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Форматируем ответ
    const formattedMessages = messages.map(msg => ({
      id: msg.id,
      topic: msg.topic,
      text: msg.text,
      recipient: msg.recipient ? msg.recipient.fullName : 'Неизвестно',
      sender: msg.sender ? msg.sender.fullName : 'Неизвестно',
      createdAt: msg.createdAt,
      isRead: msg.isRead
    }));

    res.json(formattedMessages);
  } catch (error) {
    console.error('Ошибка получения сообщений:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/messages - Отправить сообщение
router.post('/', requireAuth, async (req, res) => {
  try {
    const senderId = req.user.id;
    const { recipientId, topic, text } = req.body;

    if (!recipientId || !topic || !text) {
      return res.status(400).json({ error: 'Получатель, тема и текст обязательны' });
    }

    // Проверяем, что получатель существует
    const recipientUser = await User.findByPk(recipientId);
    if (!recipientUser) {
      return res.status(404).json({ error: 'Получатель не найден' });
    }

    // Допустимые пары ролей для переписки (аспирантура)
    const sender = await User.findByPk(senderId);
    if (!sender) {
      return res.status(404).json({ error: 'Отправитель не найден' });
    }

    if (!canExchangeMessages(sender.role, recipientUser.role)) {
      return res.status(400).json({ error: 'Недопустимая пара ролей для переписки' });
    }

    const message = await Message.create({
      senderId,
      recipientId: recipientUser.id,
      topic,
      text
    });
    await writeAudit(senderId, 'message_create', 'Message', message.id, {
      recipientId: recipientUser.id
    });

    // Получаем созданное сообщение с информацией о пользователях
    const createdMessage = await Message.findByPk(message.id, {
      include: [
        { model: User, as: 'sender', attributes: ['id', 'fullName', 'login'] },
        { model: User, as: 'recipient', attributes: ['id', 'fullName', 'login'] }
      ]
    });

    res.status(201).json({
      id: createdMessage.id,
      topic: createdMessage.topic,
      text: createdMessage.text,
      senderId: createdMessage.senderId,
      recipientId: createdMessage.recipientId,
      sender: createdMessage.sender ? createdMessage.sender.fullName : 'Неизвестно',
      recipient: createdMessage.recipient ? createdMessage.recipient.fullName : 'Неизвестно',
      createdAt: createdMessage.createdAt,
      isRead: createdMessage.isRead
    });
  } catch (error) {
    console.error('Ошибка отправки сообщения:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;

