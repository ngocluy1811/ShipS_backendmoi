const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  orderId: { type: String, required: true, index: true },
  sender: { type: String, required: true },
  content: { type: String },
  type: { type: String, default: 'text' },
  fileUrl: { type: String },
  time: { type: Date, default: Date.now }
});

module.exports = mongoose.models.ChatMessage || mongoose.model('ChatMessage', chatMessageSchema); 

