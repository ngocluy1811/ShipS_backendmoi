const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  notification_id: { type: String, required: true, unique: true },
  user_id: { type: String, required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  type: { type: String, default: 'in-app' },
  audience: { type: String, default: 'all' },
  schedule: { type: Date, default: null },
  created_at: { type: Date, default: Date.now },
  sent_at: { type: Date, default: Date.now },
  status: { type: String, default: 'unread' },
  read_at: { type: Date, default: null }
});

module.exports = mongoose.model('Notification', notificationSchema);