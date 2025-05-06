const express = require('express');
const router = express.Router();
const TransferScript = require('../models/TransferScript');
const Warehouse = require('../models/Warehouse');
const Order = require('../models/Order');

router.post('/', async (req, res) => {
  try {
    const { from_warehouse_id, to_warehouse_id, order_id } = req.body;
    if (!from_warehouse_id || !to_warehouse_id || !order_id) {
      return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ from_warehouse_id, to_warehouse_id và order_id.' });
    }
    const fromWarehouse = await Warehouse.findOne({ warehouse_id: from_warehouse_id });
    const toWarehouse = await Warehouse.findOne({ warehouse_id: to_warehouse_id });
    if (!fromWarehouse || !toWarehouse) {
      return res.status(404).json({ error: 'Kho không tồn tại.' });
    }
    const order = await Order.findOne({ order_id });
    if (!order) {
      return res.status(404).json({ error: 'Đơn hàng không tồn tại.' });
    }
    const transferScript = new TransferScript({
      transferscript_id: `transferscript_${Date.now()}`,
      from_warehouse_id,
      to_warehouse_id,
      order_id,
      confirmed_at: null
    });
    await transferScript.save();
    res.json({ message: 'Tạo phiếu chuyển kho thành công.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;