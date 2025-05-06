const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  order_id: { type: String, required: true, unique: true },
  coupon_id: { type: String },
  customer_id: { type: String, required: true },
  warehouse_id: { type: String },
  shipper_id: { type: String },
  group_id: { type: String, ref: 'GroupOrder' }, // Đảm bảo tham chiếu đúng
  pickup_address_id: { type: String, ref: 'UserAddress' },
  pickup_address: {
    street: String,
    ward: String,
    district: String,
    city: String
  },
  delivery_address_id: { type: String, ref: 'UserAddress' },
  delivery_address: {
    street: String,
    ward: String,
    district: String,
    city: String
  },
  weight: { type: Number },
  dimensions: { type: String },
  order_items: [
    {
      orderitem_id: { type: String },
      description: { type: String },
      quantity: { type: Number },
      item_type: { type: String },
      status: { type: String }
    }
  ],
  service_type: { type: String },
  item_type: { type: String },
  total_fee: { type: Number, default: 0 },
  service_fee: { type: Number, default: 0 },
  is_suburban: { type: Boolean, default: false },
  status: { type: String, default: 'pending' },
  created_at: { type: Date, default: Date.now },
  delivered_at: { type: Date },
  estimate_time: { type: Date },
  pickup_time_suggestion: { type: Date },
  updated_at: { type: Date, default: Date.now },
  payment_method: { type: String },
  payment_status: { type: String, default: 'pending' },
});

module.exports = mongoose.model('Order', orderSchema);