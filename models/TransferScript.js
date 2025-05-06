const mongoose = require('mongoose');

const transferScriptSchema = new mongoose.Schema({
  transfer_id: { type: String, required: true, unique: true }, // Đổi từ transferscript_id thành transfer_id
  from_warehouse_id: { type: String, required: true },
  to_warehouse_id: { type: String, required: true },
  order_id: { type: String, required: true },
  confirmed_at: { type: Date }
});

module.exports = mongoose.model('TransferScript', transferScriptSchema);