const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  orderitem_id: { type: String, required: true, unique: true },
  order_id: { type: String, required: true },
  description: { type: String, required: true },
  quantity: { type: Number, required: true },
  item_type: { type: String, required: true }
});

module.exports = mongoose.model('OrderItem', orderItemSchema);