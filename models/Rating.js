const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
  rating_id: { type: String, required: true, unique: true },
  order_id: { type: String, required: true },
  customer_id: { type: String, required: true },
  rating: { type: Number, required: true },
  comment: { type: String },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Rating', ratingSchema);