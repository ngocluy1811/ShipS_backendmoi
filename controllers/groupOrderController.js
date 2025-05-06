const express = require('express');
const router = express.Router();
const GroupOrder = require('../models/GroupOrder');
const CarTransport = require('../models/CarTransport');
const Order = require('../models/Order');

router.post('/', async (req, res) => {
  try {
    const { car_id, province, district } = req.body;
    if (!car_id || !province || !district) {
      return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ car_id, province và district.' });
    }
    const car = await CarTransport.findOne({ cartransport_id: car_id });
    if (!car) {
      return res.status(404).json({ error: 'Xe vận chuyển không tồn tại.' });
    }
    const groupOrder = new GroupOrder({
      group_id: `group_${Date.now()}`, // Đổi từ grouporder_id thành group_id
      car_id,
      province,
      district,
      orders: [],
      created_at: new Date()
    });
    await groupOrder.save();
    car.assigned_group_id = groupOrder.group_id; // Đổi từ grouporder_id thành group_id
    await car.save();
    res.json({ message: 'Tạo nhóm đơn hàng thành công.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:groupId/assign-orders', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { orderIds } = req.body;
    const groupOrder = await GroupOrder.findOne({ group_id: groupId }); // Đổi từ grouporder_id thành group_id
    if (!groupOrder) {
      return res.status(404).json({ error: 'Nhóm đơn hàng không tồn tại.' });
    }
    for (const orderId of orderIds) {
      const order = await Order.findOne({ order_id: orderId });
      if (!order) {
        return res.status(404).json({ error: `Đơn hàng ${orderId} không tồn tại.` });
      }
      order.group_id = groupId;
      await order.save();
    }
    groupOrder.orders = [...groupOrder.orders, ...orderIds];
    await groupOrder.save();
    res.json({ message: 'Gán đơn hàng vào nhóm thành công.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;