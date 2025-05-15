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
    // Đếm đơn đang chờ xử lý
    const pendingOrders = orders.filter(order => {
      const status = (order.status || '').toLowerCase().trim();
      return ['pending', 'đang chờ', 'chờ xử lý', 'chờ xác nhận'].includes(status);
    }).length;
    // Đếm đơn đang giao
    const deliveringOrders = orders.filter(order => {
      const status = (order.status || '').toLowerCase().trim();
      return ['delivering', 'đang giao', 'đang vận chuyển'].includes(status);
    }).length;
    // Đếm đơn đang chuẩn bị
    const preparingOrders = orders.filter(order => {
      const status = (order.status || '').toLowerCase().trim();
      return ['preparing', 'đang chuẩn bị', 'chuẩn bị hàng'].includes(status);
    }).length;

    res.status(200).json({
      totalShippingCost,
      totalOrders,
      pendingOrders,
      deliveringOrders,
      preparingOrders,
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
    // Đếm tổng số đơn đã hủy (không phân biệt hoa thường, các trường hợp 'canceled', 'Đã hủy', 'cancelled')
    const canceledOrders = orders.filter(order => {
      const status = (order.status || '').toLowerCase();
      return status === 'canceled' || status === 'đã hủy' || status === 'cancelled';
    }).length;
    const pendingOrders = orders.filter(order => {
      const status = (order.status || '').toLowerCase();
      return status === 'pending' || status === 'chờ xử lý' || status === 'pending';
    }).length;
    const deliveringOrders = orders.filter(order => {
      const status = (order.status || '').toLowerCase();
      return status === 'delivering' || status === 'đang giao' || status === 'delivering';
    }).length;
    const preparingOrders = orders.filter(order => {
      const status = (order.status || '').toLowerCase();
      return status === 'preparing' || status === 'đang chuẩn bị' || status === 'preparing';
    }).length;
    // Tổng phí vận chuyển là tổng tất cả cost_details.total_fee.value của những đơn đã giao thành công
    const totalShippingCost = orders.reduce((sum, order) => {
      if (order.status === 'delivered' || order.status === 'Đã giao') {
        const fee = order.cost_details && order.cost_details.total_fee && typeof order.cost_details.total_fee.value === 'number'
          ? order.cost_details.total_fee.value
          : 0;
        return sum + fee;
      }
      return sum;
    }, 0);
    // Tổng tiền đã thu: chỉ đơn đã giao thành công và đã thu tiền
const collectedAmount = orders.reduce((sum, order) => {
  const status = (order.status || '').toLowerCase().trim();
  const payment = (order.payment_status || '').toLowerCase().trim();
  const value = typeof order.order_value === 'number' ? order.order_value : 0;
  if ((status === 'delivered' || status === 'đã giao') && (payment === 'paid' || payment === 'đã thu' || payment === 'pending' || payment === ' Thu Cod')) {
    return sum + value;
  }
  return sum;
}, 0);

// Tổng tiền chưa thu: chỉ đơn chờ xử lý, đang chuẩn bị, đang giao
const uncollectedAmount = orders.reduce((sum, order) => {
  const status = (order.status || '').toLowerCase().trim();
  const value = typeof order.order_value === 'number' ? order.order_value : 0;
  if (
    ['pending', 'đang chờ', 'chờ xử lý', 'chờ xác nhận', 'preparing', 'đang chuẩn bị', 'chuẩn bị hàng', 'delivering', 'đang giao', 'đang vận chuyển'].includes(status)
  ) {
    return sum + value;
  }
  return sum;
}, 0);
    res.status(200).json({
      totalOrders,
      deliveredOrders,
      canceledOrders,
      totalShippingCost,
      pendingOrders,
      deliveringOrders,
      preparingOrders,
      collectedAmount,
      uncollectedAmount,
    });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi lấy dữ liệu dashboard.' });
  }
}; 