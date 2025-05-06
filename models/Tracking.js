const mongoose = require('mongoose');

const trackingSchema = new mongoose.Schema({
  tracking_id: { type: String, required: true, unique: true },
  order_id: { type: String, required: true },
  shipper_id: { type: String, required: true },
  status: { type: String, required: true },
  location: { type: String },
  smart_suggestion: { type: String },
  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Tracking', trackingSchema);