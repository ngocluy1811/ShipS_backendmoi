const mongoose = require('mongoose');

const customerCostSchema = new mongoose.Schema({
  cost_id: { type: String, required: true, unique: true },
  customer_id: { type: String, required: true },
  total_amount: { type: Number, required: true }, // Tổng chi tiêu
  period_type: { type: String, enum: ['day', 'week', 'month', 'year'], required: true }, // Loại khoảng thời gian
  period_start: { type: Date, required: true }, // Ngày bắt đầu của khoảng thời gian
  period_end: { type: Date, required: true }, // Ngày kết thúc của khoảng thời gian
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CustomerCost', customerCostSchema);