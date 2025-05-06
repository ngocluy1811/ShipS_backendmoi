const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  payment_id: { type: String, required: true, unique: true },
  order_id: { type: String, required: true },
  customer_id: { type: String, required: true },
  amount: { type: Number, required: true },
  payment_type: { type: String, enum: ['prepaid', 'postpaid'], required: true },
  method: { type: String, enum: ['cash', 'momo', 'zalopay'], required: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' }, // Thêm status
  transaction_id: { type: String }, // Thêm transaction_id
  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Payment', paymentSchema);