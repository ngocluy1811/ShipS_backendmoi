const mongoose = require('mongoose');

const notificationListSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  title: { type: String, required: true },
  content: { type: String, required: true },
  type: { type: String, default: 'in-app' },
  audience: { type: String, default: 'all' },
  status: { type: String, enum: ['scheduled', 'sent', 'failed', 'draft'], default: 'scheduled' },
  isRead: { type: Boolean, default: false },
  data: { type: Object },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.models.NotificationList || mongoose.model('NotificationList', notificationListSchema); 

