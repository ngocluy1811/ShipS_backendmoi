const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const mongoose = require('mongoose');

// Route tìm kiếm đơn hàng (public)
router.get('/', async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.json([]);
    const regex = new RegExp(q, 'i');
    // Tạo filter cơ bản
    const filter = {
      $or: [
        { order_id: regex },
        { 'pickup_address.name': regex },
        { 'pickup_address.phone': regex },
        { 'pickup_address.street': regex },
        { 'pickup_address.ward': regex },
        { 'pickup_address.district': regex },
        { 'pickup_address.city': regex },
        { 'delivery_address.name': regex },
        { 'delivery_address.phone': regex },
        { 'delivery_address.street': regex },
        { 'delivery_address.ward': regex },
        { 'delivery_address.district': regex },
        { 'delivery_address.city': regex }
      ]
    };
    // Thêm điều kiện lọc theo customer_id nếu có
    if (req.query.customer_id) {
      filter.customer_id = req.query.customer_id;
    }
    const orders = await Order.find(filter).limit(10);
    // Format kết quả trả về để FE dễ hiển thị
    const formatted = orders.map(order => ({
      order_id: order.order_id,
      customer_id: order.customer_id,
      sender: {
        name: order.pickup_address?.name || '',
        phone: order.pickup_address?.phone || '',
        address: [order.pickup_address?.street, order.pickup_address?.ward, order.pickup_address?.district, order.pickup_address?.city].filter(Boolean).join(', ')
      },
      receiver: {
        name: order.delivery_address?.name || '',
        phone: order.delivery_address?.phone || '',
        address: [order.delivery_address?.street, order.delivery_address?.ward, order.delivery_address?.district, order.delivery_address?.city].filter(Boolean).join(', ')
      },
      status: order.status
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 