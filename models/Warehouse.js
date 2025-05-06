const mongoose = require('mongoose');

const warehouseSchema = new mongoose.Schema({
  warehouse_id: { type: String, required: true, unique: true },
  location: {
    street: String,
    ward: String,
    district: String,
    city: String
  },
  capacity: { type: Number, required: true },
  max_weight_capacity: { type: Number, required: true }, // Thêm trường max_weight_capacity
  current_load: { type: Number, default: 0 },
});

module.exports = mongoose.model('Warehouse', warehouseSchema);