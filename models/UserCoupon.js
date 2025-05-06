const mongoose = require('mongoose');

const userCouponSchema = new mongoose.Schema({
  usercoupon_id: { type: String, required: true, unique: true },
  user_id: { type: String, required: true },
  coupon_id: { type: String, required: true },
  status: { type: String, default: 'unused' }
});

module.exports = mongoose.model('UserCoupon', userCouponSchema);