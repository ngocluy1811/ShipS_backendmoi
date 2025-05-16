const mongoose = require('mongoose');


const NotificationTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  type: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('NotificationTemplate', NotificationTemplateSchema); 

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

