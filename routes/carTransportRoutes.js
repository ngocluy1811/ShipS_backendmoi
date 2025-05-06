const express = require('express');
const router = express.Router();
const CarTransport = require('../models/CarTransport');

router.post('/', async (req, res) => {
  try {
    const { licence_plate, capacity_kg, driver_name } = req.body;
    if (!licence_plate || !capacity_kg || !driver_name) {
      return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ licence_plate, capacity_kg và driver_name.' });
    }
    const carTransport = new CarTransport({
      cartransport_id: `car_${Date.now()}`,
      licence_plate,
      capacity_kg,
      driver_name,
      assigned_group_id: null
    });
    await carTransport.save();
    res.json({ message: 'Tạo xe vận chuyển thành công.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const carTransports = await CarTransport.find();
    res.json(carTransports);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
//
//