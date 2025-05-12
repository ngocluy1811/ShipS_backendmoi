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

    // Chỉ lấy đơn đã giao thành công
    const deliveredOrders = orders.filter(order => order.status === 'delivered' || order.status === 'Đã giao');
    const totalShippingCost = deliveredOrders.reduce((sum, order) => sum + (order.totalFee || 0), 0);
    const totalOrders = deliveredOrders.length;
    const pendingOrders = orders.filter(order => order.status === 'pending').length;

    res.status(200).json({
      totalShippingCost,
      totalOrders,
      pendingOrders,
    });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi lấy dữ liệu chi phí vận chuyển.' });
  }
};

exports.getAdminDashboardStats = async (req, res) => {
  try {
    const orders = await Order.find({});
    const totalOrders = orders.length;
    const deliveredOrders = orders.filter(order => order.status === 'delivered' || order.status === 'Đã giao').length;
    const canceledOrders = orders.filter(order => order.status === 'canceled' || order.status === 'Đã hủy').length;
    const totalShippingCost = orders
      .filter(order => order.status === 'delivered' || order.status === 'Đã giao')
      .reduce((sum, order) => sum + (order.totalFee || 0), 0);

    res.status(200).json({
      totalOrders,
      deliveredOrders,
      canceledOrders,
      totalShippingCost,
    });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi lấy dữ liệu dashboard.' });
  }
}; 