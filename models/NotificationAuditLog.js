const mongoose = require('mongoose');

const notificationAuditLogSchema = new mongoose.Schema({
  action: { type: String, required: true },
  user: { type: String, required: true },
  details: { type: String },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('NotificationAuditLog', notificationAuditLogSchema, 'notificationauditlog'); 