const express = require('express');
const router = express.Router();
const CustomerCost = require('../models/CustomerCost');
const Order = require('../models/Order');

// Tạo bản ghi chi tiêu (admin hoặc tự động)
router.post('/', async (req, res) => {
  try {
    const { customer_id, period_type, period_start, period_end } = req.body;

    // Chỉ admin được phép tạo bản ghi chi tiêu thủ công
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ admin được phép tạo bản ghi chi tiêu.' });
    }

    if (!customer_id || !period_type || !period_start || !period_end) {
      return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ customer_id, period_type, period_start và period_end.' });
    }

    // Tính tổng chi tiêu từ các đơn hàng đã giao thành công
    const orders = await Order.find({
      customer_id,
      status: 'delivered',
      delivered_at: { $gte: new Date(period_start), $lte: new Date(period_end) }
    });

    const total_amount = orders.reduce((sum, order) => sum + (order.total_fee || 0), 0);

    const customerCost = new CustomerCost({
      cost_id: `cost_${Date.now()}`,
      customer_id,
      total_amount,
      period_type,
      period_start: new Date(period_start),
      period_end: new Date(period_end),
      created_at: new Date()
    });

    await customerCost.save();
    res.json({ message: 'Tạo bản ghi chi tiêu thành công.', total_amount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Xem chi tiêu của customer (customer hoặc admin/staff)
router.get('/', async (req, res) => {
  try {
    const { customer_id, period_type, period_start, period_end } = req.query;

    // Nếu là customer, chỉ được xem chi tiêu của chính mình
    if (req.user.role === 'customer' && req.user.user_id !== customer_id) {
      return res.status(403).json({ error: 'Không có quyền xem chi tiêu của customer khác.' });
    }

    // Nếu không phải admin/staff/customer, không có quyền truy cập
    if (!['admin', 'staff', 'customer'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Không có quyền truy cập.' });
    }

    // Nếu không có customer_id, trả về lỗi
    if (!customer_id) {
      return res.status(400).json({ error: 'Vui lòng cung cấp customer_id.' });
    }

    // Nếu không có period_type, period_start, period_end, lấy chi tiêu đã lưu
    if (!period_type || !period_start || !period_end) {
      const costRecords = await CustomerCost.find({ customer_id });
      return res.json(costRecords);
    }

    // Kiểm tra period_type hợp lệ
    if (!['day', 'week', 'month', 'year'].includes(period_type)) {
      return res.status(400).json({ error: 'period_type phải là day, week, month hoặc year.' });
    }

    // Tính tổng chi tiêu từ các đơn hàng đã giao thành công
    const orders = await Order.find({
      customer_id,
      status: 'delivered',
      delivered_at: { $gte: new Date(period_start), $lte: new Date(period_end) }
    });

    const total_amount = orders.reduce((sum, order) => sum + (order.total_fee || 0), 0);

    // Lưu bản ghi chi tiêu mới (tùy chọn)
    const customerCost = new CustomerCost({
      cost_id: `cost_${Date.now()}`,
      customer_id,
      total_amount,
      period_type,
      period_start: new Date(period_start),
      period_end: new Date(period_end),
      created_at: new Date()
    });

    await customerCost.save();

    res.json({
      customer_id,
      period_type,
      period_start,
      period_end,
      total_amount,
      orders_count: orders.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;