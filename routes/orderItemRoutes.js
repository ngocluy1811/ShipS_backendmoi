const express = require('express');
const router = express.Router();
const OrderItem = require('../models/OrderItem');
const Order = require('../models/Order');

router.post('/', async (req, res) => {
  try {
    const { order_id, description, quantity, item_type, status } = req.body;
    if (!order_id || !description || !quantity || !item_type) {
      return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ các trường bắt buộc.' });
    }
    const order = await Order.findOne({ order_id });
    if (!order) {
      return res.status(404).json({ error: 'Đơn hàng không tồn tại.' });
    }
    if (req.user.role === 'customer' && order.customer_id !== req.user.user_id) {
      return res.status(403).json({ error: 'Không có quyền thêm mặt hàng cho đơn hàng này.' });
    }
    const orderItem = new OrderItem({
      orderitem_id: `orderitem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      order_id,
      description,
      quantity,
      item_type
    });
    await orderItem.save();
    order.order_items.push({
      orderitem_id: orderItem.orderitem_id,
      description,
      quantity,
      item_type,
      status: status || 'pending'
    });
    await order.save();
    res.json({ message: 'Tạo mặt hàng đơn hàng thành công.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:order_id', async (req, res) => {
  try {
    const { order_id } = req.params;
    const order = await Order.findOne({ order_id });
    if (!order) {
      return res.status(404).json({ error: 'Đơn hàng không tồn tại.' });
    }
    if (req.user.role === 'customer' && order.customer_id !== req.user.user_id) {
      return res.status(403).json({ error: 'Không có quyền xem mặt hàng của đơn hàng này.' });
    }
    const orderItems = await OrderItem.find({ order_id });
    res.json(orderItems);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;