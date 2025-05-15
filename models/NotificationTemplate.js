const mongoose = require('mongoose');

const notificationTemplateSchema = new mongoose.Schema({
  template_id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  type: { type: String, default: 'in-app' },
  audience: { type: String, default: 'all' },
  status: { type: String, enum: ['scheduled', 'sent', 'failed', 'draft'], default: 'scheduled' },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('NotificationTemplate', notificationTemplateSchema); 