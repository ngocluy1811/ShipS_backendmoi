const express = require('express');
const router = express.Router();
const Tracking = require('../models/Tracking');
const Order = require('../models/Order');

router.post('/', async (req, res) => {
  try {
    const { order_id, shipper_id, status, location, smart_suggestion } = req.body;

    if (req.user.role !== 'shipper') {
      return res.status(403).json({ error: 'Chỉ shipper được tạo bản ghi theo dõi.' });
    }

    if (req.user.user_id !== shipper_id) {
      return res.status(403).json({ error: 'Không có quyền tạo bản ghi cho shipper khác.' });
    }

    const order = await Order.findOne({ order_id, shipper_id });
    if (!order) {
      return res.status(404).json({ error: 'Đơn hàng không tồn tại hoặc không thuộc shipper này.' });
    }

    const tracking = new Tracking({
      tracking_id: `tracking_${Date.now()}`,
      order_id,
      shipper_id,
      status,
      location,
      smart_suggestion,
      created_at: new Date()
    });
    await tracking.save();
    res.json({ message: 'Tạo bản ghi theo dõi thành công.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;