const mongoose = require('mongoose');

const groupOrderSchema = new mongoose.Schema({
  group_id: { type: String, required: true, unique: true }, // Đổi từ grouporder_id thành group_id
  car_id: { type: String, required: true },
  province: { type: String, required: true },
  district: { type: String, required: true },
  orders: [{ type: String, ref: 'Order' }],
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('GroupOrder', groupOrderSchema);