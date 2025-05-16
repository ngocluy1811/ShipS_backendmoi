const mongoose = require('mongoose');


const NotificationListSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  type: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  data: { type: Object },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('NotificationList', NotificationListSchema); 

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

