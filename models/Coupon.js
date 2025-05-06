const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  coupon_id: { type: String, required: true, unique: true },
  code: { type: String, required: true },
  discount_type: { type: String, enum: ['percent', 'fixed'], required: true },
  discount_value: { type: Number, required: true },
  valid_from: { type: Date, required: true },
  valid_to: { type: Date, required: true },
  max_uses: { type: Number, required: true },
  uses_count: { type: Number, default: 0 },
  min_order_amount: { type: Number, default: 0 },
  is_active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Coupon', couponSchema);