const mongoose = require('mongoose');

const userAddressSchema = new mongoose.Schema({
  address_id: { type: String, required: true, unique: true },
  user_id: { type: String, required: true },
  label: { type: String },
  name: { type: String },
  phone: { type: String },
  email: { type: String },
  note: { type: String },
  street: { type: String, required: true },
  ward: { type: String, required: true },
  district: { type: String, required: true },
  city: { type: String, required: true },
  is_default: { type: Boolean, default: false },
  type: {
    type: String,
    enum: ['delivery', 'pickup'],
    required: true,
    default: 'delivery'
  }
});

module.exports = mongoose.model('UserAddress', userAddressSchema);