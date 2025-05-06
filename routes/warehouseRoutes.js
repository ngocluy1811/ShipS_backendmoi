const express = require('express');
const router = express.Router();
const Warehouse = require('../models/Warehouse');

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

module.exports = router;