const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Warehouse = require('../models/Warehouse');
const UserAddress = require('../models/UserAddress');
const OrderItem = require('../models/OrderItem');
const Coupon = require('../models/Coupon');
const User = require('../models/User');
const { getOrderById, updateOrder, assignShipperToOrder } = require('../controllers/orderController');
const requireAuth = require('../middleware/authenticateToken');
const { emitOrderClaimed } = require('../socket');
router.post('/', async (req, res) => {
  try {
    const {
      warehouse_id,
      pickup_address_id,
      delivery_address_id,
      weight,
      dimensions,
      order_items,
      service_type,
      coupon_id,
      is_suburban,
      estimate_time,
      pickup_time_suggestion,
      order_value,
      payment_method,
      payment_status
    } = req.body;

    if (!['customer', 'admin', 'staff'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Không có quyền tạo đơn hàng.' });
    }

    let customer_id;
    if (req.user.role === 'customer') {
      customer_id = req.user.user_id;
    } else {
      customer_id = req.body.customer_id;
      if (!customer_id) {
        return res.status(400).json({ error: 'Vui lòng cung cấp customer_id.' });
      }
      const customer = await User.findOne({ user_id: customer_id, role: 'customer' });
      if (!customer) {
        return res.status(404).json({ error: 'Customer không tồn tại.' });
      }
    }

    const warehouse = await Warehouse.findOne({ warehouse_id });
    if (!warehouse) {
      return res.status(404).json({ error: 'Kho không tồn tại.' });
    }
    if (warehouse.current_stock >= warehouse.capacity) {
      return res.status(400).json({ error: 'Kho đã đầy.' });
    }

    // Hàm kiểm tra trường hợp chỉ có tiền tố hoặc thiếu
    function isValidField(val) {
      if (!val || !val.trim()) return false;
      const invalidPrefixes = ['Huyện', 'Quận', 'Phường', 'Tỉnh', 'Thành phố', 'Xã'];
      return !invalidPrefixes.some(prefix => val.trim() === prefix);
    }
    // Validate pickup_address
    let pickupData = { ...req.body.pickup_address };
    ['name', 'phone', 'street', 'ward', 'district', 'city'].forEach(f => {
      if (!isValidField(pickupData[f])) {
        pickupData[f] = '';
      }
    });
    const missingPickupFields = ['name', 'phone', 'street', 'ward', 'district', 'city'].filter(f => !isValidField(pickupData[f]));
    if (missingPickupFields.length > 0) {
      return res.status(400).json({ error: 'Thiếu hoặc sai thông tin người gửi: ' + missingPickupFields.join(', ') });
    }
    // Validate delivery_address
    let deliveryData = { ...req.body.delivery_address };
    ['name', 'phone', 'street', 'ward', 'district', 'city'].forEach(f => {
      if (!isValidField(deliveryData[f])) {
        deliveryData[f] = '';
      }
    });
    const missingDeliveryFields = ['name', 'phone', 'street', 'ward', 'district', 'city'].filter(f => !isValidField(deliveryData[f]));
    if (missingDeliveryFields.length > 0) {
      return res.status(400).json({ error: 'Thiếu hoặc sai thông tin người nhận: ' + missingDeliveryFields.join(', ') });
    }
    // Bổ sung email, note nếu có
    if (req.body.pickup_address?.email) pickupData.email = req.body.pickup_address.email;
    if (req.body.pickup_address?.note) pickupData.note = req.body.pickup_address.note;
    if (req.body.delivery_address?.email) deliveryData.email = req.body.delivery_address.email;
    if (req.body.delivery_address?.note) deliveryData.note = req.body.delivery_address.note;

    // Lấy các trường phí từ FE gửi lên (nếu có)
    const shipping_fee = typeof req.body.shipping_fee === 'number' ? req.body.shipping_fee : 0;
    const service_fee_val = typeof req.body.service_fee === 'number' ? req.body.service_fee : 0;
    const packing_fee = typeof req.body.packing_fee === 'number' ? req.body.packing_fee : 0;
    const surcharge = typeof req.body.surcharge === 'number' ? req.body.surcharge : 0;
    const discount = typeof req.body.discount === 'number' ? req.body.discount : 0;
    // Các phí khác nếu có
    const over_weight_fee = typeof req.body.over_weight_fee === 'number' ? req.body.over_weight_fee : 0;
    const platform_fee = typeof req.body.platform_fee === 'number' ? req.body.platform_fee : 0;
    const overtime_fee = typeof req.body.overtime_fee === 'number' ? req.body.overtime_fee : 0;
    const waiting_fee = typeof req.body.waiting_fee === 'number' ? req.body.waiting_fee : 0;
    // Tính lại tổng tiền
    const total_fee = shipping_fee + service_fee_val + packing_fee + surcharge + over_weight_fee + platform_fee + overtime_fee + waiting_fee - discount;

    // Build cost_details chuẩn
    const cost_details = {
      distance_fee: req.body.cost_details?.distance_fee || { label: '', value: 0 },
      over_weight_fee: { label: 'Phí vượt cản', value: over_weight_fee },
      shipping_fee: { label: 'Cước phí giao hàng', value: shipping_fee },
      service_fee: { label: 'Phí dịch vụ vận chuyển', value: service_fee_val },
      packing_fee: { label: 'Phí đóng gói', value: packing_fee },
      surcharge: { label: 'Phụ thu', value: surcharge },
      platform_fee: { label: 'Phí nền tảng', value: platform_fee },
      overtime_fee: { label: 'Phí ngoài giờ', value: overtime_fee },
      waiting_fee: { label: 'Phí chờ', value: waiting_fee },
      discount: { label: 'Giảm giá', value: discount },
      total_fee: { label: 'Tổng thanh toán', value: total_fee }
    };

    let total_fee_order = total_fee;
    if (coupon_id) {
      const coupon = await Coupon.findOne({ coupon_id });
      if (!coupon) {
        return res.status(404).json({ error: 'Coupon không tồn tại.' });
      }
      if (!coupon.is_active || coupon.uses_count >= coupon.max_uses) {
        return res.status(400).json({ error: 'Coupon không khả dụng.' });
      }
      if (coupon.discount_type === 'percent') {
        total_fee_order -= total_fee_order * (coupon.discount_value / 100);
      } else {
        total_fee_order -= coupon.discount_value;
      }
      coupon.uses_count += 1;
      await coupon.save();
    }

    const order = new Order({
      order_id: `order_${Date.now()}`,
      coupon_id,
      customer_id,
      warehouse_id,
      pickup_address_id,
      pickup_address: pickupData,
      delivery_address_id,
      delivery_address: deliveryData,
      weight,
      dimensions,
      service_type,
      total_fee: total_fee_order,
      service_fee: service_fee_val,
      is_suburban: is_suburban || false,
      estimate_time,
      pickup_time_suggestion,
      payment_method,
      payment_status: payment_status || 'pending',
      created_at: new Date(),
      updated_at: new Date(),
      cost_details,
      coupon_code: req.body.coupon_code || '',
      order_value: order_value || 0,
    });

    const savedOrderItems = [];
    for (const item of order_items) {
      const orderItem = new OrderItem({
        orderitem_id: `orderitem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        order_id: order.order_id,
        description: item.description,
        quantity: item.quantity,
        item_type: item.item_type,
        code: item.code || '',
        status: item.status || 'pending'
      });
      await orderItem.save();
      savedOrderItems.push({
        orderitem_id: orderItem.orderitem_id,
        description: item.description,
        quantity: item.quantity,
        item_type: item.item_type,
        code: item.code || '',
        status: item.status || 'pending'
      });
    }

    order.order_items = savedOrderItems;
    await order.save();

    warehouse.current_stock += 1;
    await warehouse.save();
    res.json({ message: 'Tạo đơn hàng thành công.', order_id: order.order_id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { customer_id, shipper_id, status } = req.query;
    const query = {};
    if (req.user.role === 'customer') {
      query.customer_id = req.user.user_id;
    } else if (req.user.role === 'shipper') {
      query.shipper_id = req.user.user_id;
    } else if (req.user.role !== 'admin' && req.user.role !== 'staff') {
      return res.status(403).json({ error: 'Không có quyền truy cập.' });
    }
    if (customer_id && (req.user.role === 'admin' || req.user.role === 'staff')) query.customer_id = customer_id;
    if (shipper_id && (req.user.role === 'admin' || req.user.role === 'staff')) {
      const shipper = await User.findOne({ user_id: shipper_id, role: 'shipper' });
      if (!shipper) {
        return res.status(404).json({ error: 'Shipper không tồn tại.' });
      }
      query.shipper_id = shipper_id;
      query.warehouse_id = shipper.warehouse_id;
    }
    if (status) {
      query.status = status;
    }
    const orders = await Order.find(query);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:order_id/status', async (req, res) => {
  try {
    const { order_id } = req.params;
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Vui lòng cung cấp status.' });
    }
    const allowedStatuses = ['pending', 'preparing', 'delivering', 'delivered'];
    const nextStatus = String(status).toLowerCase().trim();
    if (!allowedStatuses.includes(nextStatus)) {
      return res.status(400).json({ error: 'Trạng thái không hợp lệ. Chỉ chấp nhận: pending, preparing, delivering, delivered.' });
    }
    const order = await Order.findOne({ order_id });
    if (!order) {
      return res.status(404).json({ error: 'Đơn hàng không tồn tại.' });
    }
    if (req.user.role === 'shipper' && order.shipper_id !== req.user.user_id) {
      return res.status(403).json({ error: 'Không có quyền cập nhật trạng thái cho đơn hàng này.' });
    }
    const currentStatus = String(order.status).toLowerCase().trim();
    const statusFlow = ['pending', 'preparing', 'delivering', 'delivered'];
    const currentIndex = statusFlow.indexOf(currentStatus);
    const nextIndex = statusFlow.indexOf(nextStatus);
    if (currentIndex === -1) {
      return res.status(400).json({ error: 'Trạng thái hiện tại của đơn hàng không hợp lệ.' });
    }
    if (nextIndex === -1) {
      return res.status(400).json({ error: 'Trạng thái mới không hợp lệ.' });
    }
    if (nextIndex === currentIndex) {
      return res.status(400).json({ error: 'Trạng thái mới phải khác trạng thái hiện tại.' });
    }
    if (nextIndex < currentIndex) {
      return res.status(400).json({ error: 'Không thể cập nhật lùi về trạng thái trước.' });
    }
    if (nextIndex > currentIndex + 1) {
      return res.status(400).json({ error: 'Không thể bỏ qua bước trạng thái.' });
    }
    order.status = status;
    if (status === 'delivered') {
      order.delivered_at = new Date();
    }
    order.updated_at = new Date();
    // Thêm vào timeline
    if (!Array.isArray(order.timeline)) order.timeline = [];
    let description = '';
    switch (status) {
      case 'preparing':
        description = 'Đơn hàng đang được chuẩn bị để giao cho shipper'; break;
      case 'delivering':
        description = 'Shipper đang giao hàng'; break;
      case 'delivered':
        description = 'Đơn hàng đã giao thành công'; break;
      case 'cancelled':
      case 'Đã hủy':
        description = 'Đơn hàng đã bị hủy'; break;
      default:
        description = '';
    }
    order.timeline.push({
      status,
      time: new Date(),
      shipper_id: order.shipper_id || null,
      description
    });
    await order.save();

    // Emit socket event to both order_id room and 'orders' room
    const io = require('../socket').getIO();
    if (io) {
      io.to(order_id).emit('order_status_updated', {
        order_id,
        status,
        updated_at: order.updated_at,
        timeline: order.timeline
      });
      io.to('orders').emit('order_status_updated', {
        order_id,
        status,
        updated_at: order.updated_at,
        timeline: order.timeline
      });
      console.log('[SOCKET] Emitted order_status_updated for order:', order_id, 'and to orders room');
    }

    res.json({ message: 'Cập nhật trạng thái đơn hàng thành công.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:order_id', requireAuth(['admin', 'staff', 'customer', 'shipper']), updateOrder);

router.get('/:order_id', requireAuth(['admin', 'staff', 'customer', 'shipper']), getOrderById);

router.post('/:order_id/claim', requireAuth(['shipper']), async (req, res) => {
  try {
    const { order_id } = req.params;
    const shipper_id = req.user.user_id;

    // Tìm đơn hàng
    const order = await Order.findOne({ order_id });
    if (!order) {
      return res.status(404).json({ error: 'Đơn hàng không tồn tại.' });
    }

    // Kiểm tra trạng thái đơn hàng đã bị hủy chưa
    if (order.status === 'cancelled' || order.status === 'Đã hủy') {
      return res.status(400).json({ error: 'Đơn hàng đã bị hủy, shipper không thể nhận đơn này.' });
    }

    // Kiểm tra đơn đã có shipper chưa
    if (order.shipper_id) {
      return res.status(400).json({ error: 'Đơn hàng đã có shipper nhận.' });
    }

    // Kiểm tra shipper có thuộc kho của đơn hàng không
    if (order.warehouse_id && req.user.warehouse_id && order.warehouse_id !== req.user.warehouse_id) {
      return res.status(400).json({ error: 'Bạn không thuộc kho của đơn hàng này.' });
    }

    // Lấy thông tin shipper
    const shipper = await User.findOne({ user_id: shipper_id });
    if (!shipper) {
      return res.status(404).json({ error: 'Không tìm thấy thông tin shipper.' });
    }

    // Cập nhật thông tin shipper và trạng thái đơn hàng
    order.shipper_id = shipper_id;
    order.shipper_info = {
      name: shipper.name,
      phone: shipper.phone,
      email: shipper.email,
      avatar: shipper.avatar || '',
      vehicle_info: shipper.vehicle_info || {}
    };
    order.status = 'preparing'; // Trạng thái đang chuẩn bị
    order.updated_at = new Date();
    order.claimed_at = new Date(); // Thời điểm shipper nhận đơn

    // Thêm vào timeline
    if (!Array.isArray(order.timeline)) order.timeline = [];
    order.timeline.push({
      status: 'preparing',
      time: new Date(),
      shipper_id: shipper_id,
      description: 'Đơn hàng đang được chuẩn bị để giao cho shipper'
    });

    await order.save();

    // Emit event order_claimed
    emitOrderClaimed(order.order_id, shipper.name, order.status, order.claimed_at);

    // Emit event order_status_updated to notify status change
    const io = require('../socket').getIO();
    if (io) {
      io.to(order_id).emit('order_status_updated', {
        order_id,
        status: order.status,
        updated_at: order.updated_at,
        timeline: order.timeline
      });
      io.to('orders').emit('order_status_updated', {
        order_id,
        status: order.status,
        updated_at: order.updated_at,
        timeline: order.timeline
      });
      console.log('[SOCKET] Emitted order_status_updated for order:', order_id, 'and to orders room');
    }

    res.json({ 
      message: 'Nhận đơn thành công!', 
      order: {
        order_id: order.order_id,
        status: order.status,
        shipper_info: order.shipper_info,
        claimed_at: order.claimed_at
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// REST API gửi chat message qua socket.io
router.post('/chat/message', (req, res) => {
  const io = req.app.get('io');
  const { orderId, sender, content } = req.body;
  if (!orderId || !sender || !content) {
    return res.status(400).json({ error: 'orderId, sender, content required' });
  }
  const msg = {
    id: Date.now().toString(),
    orderId,
    sender,
    content,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    status: 'sent',
    type: 'text'
  };
  if (io) {
    io.to(orderId).emit('chat_message', msg);
  }
  res.json({ success: true, message: msg });
});

// Tìm kiếm đơn hàng theo nhiều trường
router.get('/search', async (req, res) => {
  try {
    const q = req.query.q || '';
    if (!q) return res.json([]);
    const regex = new RegExp(q, 'i');
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
    if (req.query.customer_id) {
      filter.customer_id = req.query.customer_id;
    }
    console.log('[DEBUG] /orders/search filter:', JSON.stringify(filter));
    const orders = await Order.find(filter).limit(10);
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.post('/:order_id/assign-shipper', requireAuth(['admin', 'staff', 'shipper']), assignShipperToOrder);

// Thống kê số lượng đơn hàng theo tháng trong năm hiện tại
router.get('/stats-by-month', async (req, res) => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    // Lấy tất cả đơn hàng trong năm hiện tại
    const orders = await Order.find({
      created_at: {
        $gte: new Date(`${year}-01-01T00:00:00.000Z`),
        $lte: new Date(`${year}-12-31T23:59:59.999Z`)
      }
    });
    // Đếm số lượng đơn theo từng tháng
    const stats = Array(12).fill(0);
    orders.forEach(order => {
      const month = new Date(order.created_at).getMonth(); // 0-11
      stats[month]++;
    });
    res.json({ year, stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


module.exports = router;