const express = require('express');
const router = express.Router();
const Rating = require('../models/Rating');
const Order = require('../models/Order');

router.post('/', async (req, res) => {
  try {
    const { order_id, rating, comment } = req.body;
    if (!order_id || !rating) {
      return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ order_id và rating.' });
    }
    const order = await Order.findOne({ order_id, customer_id: req.user.user_id });
    if (!order) {
      return res.status(404).json({ error: 'Đơn hàng không tồn tại hoặc không thuộc khách hàng này.' });
    }
    const ratingRecord = new Rating({
      rating_id: `rating_${Date.now()}`,
      order_id,
      customer_id: req.user.user_id,
      rating,
      comment,
      created_at: new Date()
    });
    await ratingRecord.save();
    res.json({ message: 'Tạo đánh giá thành công.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;