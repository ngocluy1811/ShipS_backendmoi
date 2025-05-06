const express = require('express');
const router = express.Router();
const Salary = require('../models/Salary');
const Order = require('../models/Order');
const User = require('../models/User');

// Tạo bản ghi lương thủ công (giữ nguyên code ban đầu)
router.post('/', async (req, res) => {
  try {
    // Chỉ admin được phép tạo bản ghi lương thủ công
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ admin được phép tạo bản ghi lương.' });
    }

    const { user_id, date, total_salary } = req.body;
    if (!user_id || !date || !total_salary) {
      return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ user_id, date và total_salary.' });
    }

    const user = await User.findOne({ user_id });
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại.' });
    }

    const salary = new Salary({
      salary_id: `salary_${Date.now()}`,
      user_id,
      date,
      total_salary,
      details: {} // Để trống vì đây là nhập thủ công
    });
    await salary.save();
    res.json({ message: 'Tạo bản ghi lương thành công.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Tính lương tự động cho shipper
router.post('/calculate-shipper', async (req, res) => {
  try {
    // Chỉ admin được phép tính lương
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ admin được phép tính lương.' });
    }

    const { user_id, start_date, end_date } = req.body;
    if (!user_id || !start_date || !end_date) {
      return res.status(400).json({ error: 'Vui lòng cung cấp user_id, start_date và end_date.' });
    }

    // Kiểm tra shipper tồn tại
    const shipper = await User.findOne({ user_id, role: 'shipper' });
    if (!shipper) {
      return res.status(404).json({ error: 'Shipper không tồn tại.' });
    }

    // Tìm các đơn hàng shipper đã giao thành công trong khoảng thời gian
    const orders = await Order.find({
      shipper_id: user_id,
      status: 'delivered',
      delivered_at: { $gte: new Date(start_date), $lte: new Date(end_date) }
    });

    // Tính lương
    const baseRatePerOrder = 5000; // 5,000 VNĐ/đơn
    const bonusPerOrder = orders.length > 50 ? 2000 : 0; // Thưởng 2,000 VNĐ/đơn nếu giao trên 50 đơn
    const totalOrders = orders.length;
    const baseSalary = totalOrders * baseRatePerOrder;
    const bonusSalary = totalOrders * bonusPerOrder;

    // Tính số ngày làm việc (có ít nhất 1 đơn hàng giao thành công)
    const uniqueDays = [...new Set(orders.map(order => new Date(order.delivered_at).toISOString().split('T')[0]))];
    const dailyAllowance = uniqueDays.length * 50000; // 50,000 VNĐ/ngày

    const total_salary = baseSalary + bonusSalary + dailyAllowance;

    // Tạo bản ghi lương
    const salary = new Salary({
      salary_id: `salary_${Date.now()}`,
      user_id,
      date: new Date(),
      total_salary,
      details: {
        total_orders: totalOrders,
        base_rate: baseRatePerOrder,
        bonus_rate: bonusPerOrder,
        daily_allowance: dailyAllowance,
        unique_days: uniqueDays.length
      }
    });

    await salary.save();
    res.json({
      message: 'Tính lương thành công.',
      total_salary,
      details: {
        total_orders: totalOrders,
        base_salary: baseSalary,
        bonus_salary: bonusSalary,
        daily_allowance: dailyAllowance,
        unique_days: uniqueDays.length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Tính lương tự động cho staff/admin
router.post('/calculate-staff', async (req, res) => {
  try {
    // Chỉ admin được phép tính lương
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ admin được phép tính lương.' });
    }

    const { user_id, start_date, end_date } = req.body;
    if (!user_id || !start_date || !end_date) {
      return res.status(400).json({ error: 'Vui lòng cung cấp user_id, start_date và end_date.' });
    }

    // Kiểm tra staff/admin tồn tại
    const user = await User.findOne({ user_id, role: { $in: ['staff', 'admin'] } });
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại.' });
    }

    // Tìm các đơn hàng được xử lý trong khoảng thời gian
    const orders = await Order.find({
      warehouse_id: user.warehouse_id, // Giả định staff xử lý đơn hàng trong kho của mình
      updated_at: { $gte: new Date(start_date), $lte: new Date(end_date) }
    });

    // Tính lương
    const baseRatePerDay = 300000; // 300,000 VNĐ/ngày
    const bonusThreshold = 100; // Thưởng nếu xử lý trên 100 đơn
    const bonusAmount = orders.length > bonusThreshold ? 100000 : 0; // Thưởng 100,000 VNĐ

    // Tính số ngày làm việc
    const uniqueDays = [...new Set(orders.map(order => new Date(order.updated_at).toISOString().split('T')[0]))];
    const baseSalary = uniqueDays.length * baseRatePerDay;
    const total_salary = baseSalary + bonusAmount;

    // Tạo bản ghi lương
    const salary = new Salary({
      salary_id: `salary_${Date.now()}`,
      user_id,
      date: new Date(),
      total_salary,
      details: {
        total_orders: orders.length,
        base_rate_per_day: baseRatePerDay,
        unique_days: uniqueDays.length,
        bonus_amount: bonusAmount
      }
    });

    await salary.save();
    res.json({
      message: 'Tính lương thành công.',
      total_salary,
      details: {
        total_orders: orders.length,
        base_salary: baseSalary,
        unique_days: uniqueDays.length,
        bonus_amount: bonusAmount
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Xem lương của shipper/staff/admin
router.get('/', async (req, res) => {
  try {
    const query = {};
    if (req.user.role === 'customer') {
      return res.status(403).json({ error: 'Không có quyền truy cập.' });
    } else if (req.user.role !== 'admin') {
      query.user_id = req.user.user_id; // Shipper/staff chỉ xem lương của mình
    }

    const salaries = await Salary.find(query);
    res.json(salaries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;