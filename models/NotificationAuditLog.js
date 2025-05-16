const mongoose = require('mongoose');


const NotificationAuditLogSchema = new mongoose.Schema({
  notificationId: { type: mongoose.Schema.Types.ObjectId, ref: 'NotificationList' },
  action: { type: String, required: true },
  performer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  details: { type: Object },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('NotificationAuditLog', NotificationAuditLogSchema); 

const notificationAuditLogSchema = new mongoose.Schema({
  action: { type: String, required: true },
  user: { type: String, required: true },
  details: { type: String },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('NotificationAuditLog', notificationAuditLogSchema, 'notificationauditlog'); 

