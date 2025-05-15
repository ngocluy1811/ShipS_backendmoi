const mongoose = require('mongoose');

const notificationListSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  type: { type: String, default: 'in-app' },
  audience: { type: String, default: 'all' },
  status: { type: String, enum: ['scheduled', 'sent', 'failed', 'draft'], default: 'scheduled' },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('NotificationList', notificationListSchema, 'notificationlist'); 