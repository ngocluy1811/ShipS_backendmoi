const express = require('express');
const router = express.Router();
const Warehouse = require('../models/Warehouse');
const User = require('../models/User');

router.post('/', async (req, res) => {
  try {
    const { warehouse_id, location, capacity, max_weight_capacity } = req.body;
    if (!warehouse_id || !location || !capacity || !max_weight_capacity) {
      return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ các trường bắt buộc.' });
    }
    const warehouse = new Warehouse({
      warehouse_id,
      location,
      capacity,
      max_weight_capacity,
      current_stock: 0
    });
    await warehouse.save();
    res.json({ message: 'Tạo kho thành công.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const warehouses = await Warehouse.find();
    res.json(warehouses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:warehouse_id/assign-shipper', async (req, res) => {
  try {
    const { warehouse_id } = req.params;
    const { shipper_id } = req.body;
    const warehouse = await Warehouse.findOne({ warehouse_id });
    if (!warehouse) {
      return res.status(404).json({ error: 'Kho không tồn tại.' });
    }
    const shipper = await User.findOne({ user_id: shipper_id, role: 'shipper' });
    if (!shipper) {
      return res.status(404).json({ error: 'Shipper không tồn tại.' });
    }
    shipper.warehouse_id = warehouse_id;
    await shipper.save();
    res.json({ message: 'Gán shipper vào kho thành công.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;