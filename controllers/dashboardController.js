const Order = require('../models/Order');

exports.getShippingCosts = async (req, res) => {
  try {
    const { period } = req.query; // period: month, year, v.v.
    const now = new Date();
    let startDate;

    if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1);
    } else {
      return res.status(400).json({ error: 'Period không hợp lệ.' });
    }

    const orders = await Order.find({
      createdAt: { $gte: startDate, $lte: now },
    });

    const totalShippingCost = orders.reduce((sum, order) => sum + (order.totalFee || 0), 0);
    const paidOrders = orders.filter(order => order.paymentMethod && order.status === 'delivered');
    const totalPaid = paidOrders.reduce((sum, order) => sum + (order.totalFee || 0), 0);
    const pendingOrders = orders.filter(order => order.status === 'pending').length;

    res.status(200).json({
      totalShippingCost,
      totalPaid,
      totalOrders: orders.length,
      pendingOrders,
    });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi lấy dữ liệu chi phí vận chuyển.' });
  }
}; 