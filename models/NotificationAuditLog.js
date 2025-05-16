const mongoose = require('mongoose');

const notificationAuditLogSchema = new mongoose.Schema({
  notificationId: { type: mongoose.Schema.Types.ObjectId, ref: 'NotificationList' },
  action: { type: String, required: true },
  performer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  user: { type: String },
  details: { type: Object },
  createdAt: { type: Date, default: Date.now },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.models.NotificationAuditLog || mongoose.model('NotificationAuditLog', notificationAuditLogSchema); 

