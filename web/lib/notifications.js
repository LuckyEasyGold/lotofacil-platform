/**
 * lib/notifications.js — Criação de notificações (extraído do server.js).
 */
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

async function addNotification(userId, type, title, message, link = null) {
  await db.addNotification({
    id: uuidv4(), userId, type, title, message, link,
    read: false, createdAt: new Date().toISOString()
  });
}

module.exports = { addNotification };
