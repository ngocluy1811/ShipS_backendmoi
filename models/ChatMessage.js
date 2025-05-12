const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  orderId: { type: String, required: true },
  sender: { type: String, required: true }, // user_id hoặc role
  content: { type: String }, // nội dung tin nhắn
  type: { type: String, default: 'text' }, // text, image, file, ...
  fileUrl: { type: String }, // nếu là file
  time: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ChatMessage', chatMessageSchema); 