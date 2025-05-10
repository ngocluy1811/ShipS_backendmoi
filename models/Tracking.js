const mongoose = require('mongoose');

const trackingSchema = new mongoose.Schema({
  tracking_id: { type: String, required: true, unique: true },
  order_id: { type: String, required: true },
  shipper_id: { type: String, required: true },
  status: {
    type: String,
    enum: ['active', 'stopped'],
    default: 'active'
  },
  location: {
    lat: Number,
    lng: Number
  },
  started_at: { type: Date, default: Date.now },
  stopped_at: { type: Date },
  smart_suggestion: { type: String },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, { timestamps: true });

trackingSchema.index({ order_id: 1, shipper_id: 1 });
trackingSchema.index({ status: 1 });

// Update updated_at before save
trackingSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

const Tracking = mongoose.model('Tracking', trackingSchema);
module.exports = Tracking;