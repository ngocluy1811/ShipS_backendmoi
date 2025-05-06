const mongoose = require('mongoose');

const carTransportSchema = new mongoose.Schema({
  cartransport_id: { type: String, required: true, unique: true },
  license_plate: { type: String, required: true },
  capacity_kg: { type: Number, required: true },
  driver_name: { type: String, required: true },
  assigned_group_id: { type: String, ref: 'GroupOrder' } // Đảm bảo tham chiếu đúng
});

module.exports = mongoose.model('CarTransport', carTransportSchema);