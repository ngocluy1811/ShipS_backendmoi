const express = require('express');
const router = express.Router();
const axios = require('axios'); // Thêm axios để gọi Google Maps API
const Order = require('../models/Order');
const Warehouse = require('../models/Warehouse');
const UserAddress = require('../models/UserAddress');
const OrderItem = require('../models/OrderItem');
const Coupon = require('../models/Coupon');
const User = require('../models/User');
const Rating = require('../models/Rating');

// Hàm tính khoảng cách thực tế bằng Google Maps API
const calculateDistance = async (pickupAddress, deliveryAddress) => {
  try {
    console.log('GOOGLE_MAPS_API_KEY:', process.env.GOOGLE_MAPS_API_KEY);
    const pickup = `${pickupAddress.street}, ${pickupAddress.ward}, ${pickupAddress.district}, ${pickupAddress.city}`;
    const delivery = `${deliveryAddress.street}, ${deliveryAddress.ward}, ${deliveryAddress.district}, ${deliveryAddress.city}`;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    // Nếu không có API key, sử dụng fallback ngay lập tức
    if (!apiKey) {
      console.log('Không có Google Maps API key, sử dụng phương pháp tính khoảng cách mô phỏng');
      return calculateDistanceFallback(pickupAddress, deliveryAddress);
    }

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(pickup)}&destinations=${encodeURIComponent(delivery)}&key=${apiKey}`;

    const response = await axios.get(url);
    const data = response.data;

    if (data.status === 'OK' && data.rows[0].elements[0].status === 'OK') {
      const distanceInMeters = data.rows[0].elements[0].distance.value;
      return distanceInMeters / 1000; // Chuyển đổi từ mét sang km
    } else {
      console.log('Không thể tính khoảng cách bằng Google Maps API, sử dụng phương pháp mô phỏng');
      return calculateDistanceFallback(pickupAddress, deliveryAddress);
    }
  } catch (error) {
    console.error('Lỗi khi tính khoảng cách:', error.message);
    return calculateDistanceFallback(pickupAddress, deliveryAddress);
  }
};

// Logic mô phỏng nếu không dùng API
const calculateDistanceFallback = (pickupAddress, deliveryAddress) => {
  try {
    if (pickupAddress.ward === deliveryAddress.ward &&
        pickupAddress.district === deliveryAddress.district &&
        pickupAddress.city === deliveryAddress.city) {
      return 2; // 2km
    }
    if (pickupAddress.district === deliveryAddress.district &&
        pickupAddress.city === deliveryAddress.city) {
      return 10; // 10km
    }
    if (pickupAddress.city === deliveryAddress.city) {
      return 30; // 30km
    }

    const northCities = ['Hà Nội', 'Hải Phòng'];
    const centralCities = ['Đà Nẵng'];
    const southCities = ['TP.HCM', 'Bình Dương'];

    const pickupRegion = northCities.includes(pickupAddress.city) ? 'north' :
                         centralCities.includes(pickupAddress.city) ? 'central' :
                         southCities.includes(pickupAddress.city) ? 'south' : 'other';
    const deliveryRegion = northCities.includes(deliveryAddress.city) ? 'north' :
                           centralCities.includes(deliveryAddress.city) ? 'central' :
                           southCities.includes(deliveryAddress.city) ? 'south' : 'other';

    if (pickupRegion === deliveryRegion) {
      return 100;
    } else if ((pickupRegion === 'north' && deliveryRegion === 'south') ||
               (pickupRegion === 'south' && deliveryRegion === 'north')) {
      return 1200;
    } else if ((pickupRegion === 'north' && deliveryRegion === 'central') ||
               (pickupRegion === 'central' && deliveryRegion === 'north')) {
      return 800;
    } else if ((pickupRegion === 'central' && deliveryRegion === 'south') ||
               (pickupRegion === 'south' && deliveryRegion === 'central')) {
      return 900;
    }
    return 500;
  } catch (error) {
    console.error('Lỗi khi tính khoảng cách mô phỏng:', error.message);
    return 50; // Trả về giá trị mặc định nếu có lỗi
  }
};

// Hàm tính phí vận chuyển
const calculateShippingFee = (weight, dimensions, distance, service_type, is_suburban, order_value = 0) => {
  let regionType = 'intra_province'; // Nội tỉnh
  if (distance > 30) {
    regionType = distance > 100 ? 'inter_region' : 'same_region'; // Liên tỉnh
  }

  let baseFee, additionalFeePerKg;
  if (regionType === 'intra_province') {
    baseFee = 22000; // 22,000 VNĐ cho 2kg đầu
    additionalFeePerKg = 2500; // 2,500 VNĐ/kg tiếp theo
  } else if (regionType === 'same_region') {
    baseFee = 30000; // 30,000 VNĐ cho 2kg đầu
    additionalFeePerKg = 5000; // 5,000 VNĐ/kg tiếp theo
  } else {
    baseFee = 35000; // 35,000 VNĐ cho 2kg đầu
    additionalFeePerKg = 6000; // 6,000 VNĐ/kg tiếp theo
  }

  let weightFee = baseFee;
  if (weight > 2) {
    weightFee += (weight - 2) * additionalFeePerKg;
  }

  const [length, width, height] = dimensions.split('x').map(Number);
  const volumetricWeight = (length * width * height) / 5000;
  const finalWeight = Math.max(weight, volumetricWeight);
  if (finalWeight > 2) {
    weightFee = baseFee + (finalWeight - 2) * additionalFeePerKg;
  }

  let serviceMultiplier = 1;
  if (service_type === 'expedited') {
    serviceMultiplier = 1.5;
  } else if (service_type === 'express') {
    serviceMultiplier = 2;
  }

  const totalShippingFee = weightFee * serviceMultiplier;

  const codFee = order_value > 0 ? Math.max(10000, Math.min(50000, order_value * 0.008)) : 0;
  const suburbanFee = is_suburban ? 10000 : 0;
  const insuranceFee = order_value > 0 ? Math.max(2000, order_value * 0.005) : 0;

  return {
    shipping_fee: Math.round(totalShippingFee),
    additional_fees: {
      cod_fee: Math.round(codFee),
      suburban_fee: Math.round(suburbanFee),
      insurance_fee: Math.round(insuranceFee),
      total_additional: Math.round(codFee + suburbanFee + insuranceFee)
    }
  };
};

// API tính phí vận chuyển trước khi tạo đơn hàng
router.post('/calculate-shipping-fee', async (req, res) => {
  try {
    const {
      pickup_address_id,
      delivery_address_id,
      weight,
      dimensions,
      service_type,
      is_suburban,
      order_value
    } = req.body;

    if (!pickup_address_id || !delivery_address_id || !weight || !dimensions || !service_type) {
      return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ thông tin.' });
    }

    const pickupAddress = await UserAddress.findOne({ address_id: pickup_address_id });
    const deliveryAddress = await UserAddress.findOne({ address_id: delivery_address_id });
    if (!pickupAddress || !deliveryAddress) {
      return res.status(404).json({ error: 'Địa chỉ không tồn tại.' });
    }

    if (!['standard', 'expedited', 'express'].includes(service_type)) {
      return res.status(400).json({ error: 'Loại hình giao hàng không hợp lệ.' });
    }

    const distance = await calculateDistance(pickupAddress, deliveryAddress);
    const fees = calculateShippingFee(weight, dimensions, distance, service_type, is_suburban || false, order_value || 0);

    res.json({
      shipping_fee: fees.shipping_fee,
      additional_fees: fees.additional_fees,
      distance: distance,
      service_type: service_type
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Tạo đơn hàng
router.post('/', async (req, res) => {
  try {
    console.log('Order create body:', JSON.stringify(req.body, null, 2));
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
      order_value
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

    const pickupAddress = await UserAddress.findOne({ address_id: pickup_address_id });
    const deliveryAddress = await UserAddress.findOne({ address_id: delivery_address_id });
    if (!pickupAddress || !deliveryAddress) {
      return res.status(404).json({ error: 'Địa chỉ không tồn tại.' });
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

    // Lấy distance từ FE nếu có, nếu không thì tự tính
    const distance = typeof req.body.distance === 'number' ? req.body.distance : await calculateDistance(pickupAddress, deliveryAddress);
    const fees = calculateShippingFee(weight, dimensions, distance, service_type, is_suburban || false, order_value || 0);

    // Lấy các trường phí từ FE gửi lên (nếu có)
    const {
      shipping_fee: body_shipping_fee,
      service_fee: body_service_fee,
      package_fee: body_package_fee,
      surcharge: body_surcharge,
      discount: body_discount,
      total_fee: body_total_fee,
      pricing: body_pricing,
      platform_fee: body_platform_fee,
      overtime_fee: body_overtime_fee,
      waiting_fee: body_waiting_fee
    } = req.body;

    let total_fee = fees.shipping_fee + fees.additional_fees.total_additional;
    let coupon_discount = 0;
    if (coupon_id) {
      const coupon = await Coupon.findOne({ coupon_id });
      if (!coupon) {
        return res.status(404).json({ error: 'Coupon không tồn tại.' });
      }
      if (!coupon.is_active || coupon.uses_count >= coupon.max_uses) {
        return res.status(400).json({ error: 'Coupon không khả dụng.' });
      }
      if (coupon.discount_type === 'percent') {
        coupon_discount = total_fee * (coupon.discount_value / 100);
      } else {
        coupon_discount = coupon.discount_value;
      }
      total_fee -= coupon_discount;
      coupon.uses_count += 1;
      await coupon.save();
    }

    // Nếu FE gửi đủ phí thì dùng, nếu không thì tính lại (bảo vệ)
    const finalServiceFee = typeof body_service_fee === 'number' ? body_service_fee : (fees?.shipping_fee || 0);
    const finalTotalFee = typeof body_total_fee === 'number' ? body_total_fee : (fees?.shipping_fee + (fees?.additional_fees?.total_additional || 0) - (coupon_discount || 0));

    // Lấy loại hàng hóa chính từ order_items[0]
    const mainItemType = Array.isArray(order_items) && order_items.length > 0 ? order_items[0].item_type : '';

    // Đơn giá ship theo km (có thể điều chỉnh theo chính sách)
    const PER_KM_FEE = 1000;
    const distanceNum = Number(distance) || 0;
    // Build cost_details chi tiết từng loại phí (luôn đủ trường, không để object rỗng)
    const cost_details = {
      distance_fee: {
        label: `Phí ship theo khoảng cách (${distanceNum.toFixed(2)} km)`,
        value: distanceNum > 0 ? Math.round(distanceNum * PER_KM_FEE) : 0
      },
      over_weight_fee: {
        label: 'Phí vượt cản',
        value: fees.additional_fees?.suburban_fee || 0
      },
      shipping_fee: {
        label: 'Cước phí giao hàng',
        value: typeof body_shipping_fee === 'number' ? body_shipping_fee : 0
      },
      service_fee: {
        label: 'Phí dịch vụ vận chuyển',
        value: typeof body_service_fee === 'number' ? body_service_fee : 0
      },
      packing_fee: {
        label: 'Phí đóng gói',
        value: typeof body_package_fee === 'number' ? body_package_fee : 0
      },
      surcharge: {
        label: 'Phụ thu',
        value: typeof body_surcharge === 'number' ? body_surcharge : 0
      },
      insurance_fee: {
        label: 'Phí bảo hiểm',
        value: fees.additional_fees?.insurance_fee || 0
      },
      platform_fee: {
        label: 'Phí nền tảng',
        value: typeof body_platform_fee === 'number' ? body_platform_fee : 0
      },
      overtime_fee: {
        label: 'Phí ngoài giờ',
        value: typeof body_overtime_fee === 'number' ? body_overtime_fee : 0
      },
      waiting_fee: {
        label: 'Phí chờ',
        value: typeof body_waiting_fee === 'number' ? body_waiting_fee : 0
      },
      discount: {
        label: 'Giảm giá',
        value: typeof body_discount === 'number' ? body_discount : 0
      },
      total_fee: {
        label: 'Tổng thanh toán',
        value: finalTotalFee
      }
    };

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
      item_type: mainItemType, // Lưu loại hàng hóa chính
      total_fee: finalTotalFee,
      service_fee: finalServiceFee,
      is_suburban: is_suburban || false,
      estimate_time,
      pickup_time_suggestion,
      created_at: new Date(),
      updated_at: new Date(),
      coupon_code: req.body.coupon_code || '',
      cost_details,
      order_value: order_value || 0,
      payment_method: req.body.payment_method || '',
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
    res.json({
      message: 'Tạo đơn hàng thành công.',
      order_id: order.order_id,
      cost_details
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { customer_id, shipper_id, status, created_at } = req.query;
    const query = {};

    if (req.user.role === 'customer') {
      query.customer_id = req.user.user_id;
    } else if (req.user.role === 'shipper') {
      query.shipper_id = req.user.user_id;
    } else if (req.user.role !== 'admin' && req.user.role !== 'staff') {
      return res.status(403).json({ error: 'Không có quyền truy cập.' });
    }

    if (customer_id && (req.user.role === 'admin' || req.user.role === 'staff')) {
      query.customer_id = customer_id;
    }

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

    if (created_at) {
      const startOfDay = new Date(created_at);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(created_at);
      endOfDay.setHours(23, 59, 59, 999);
      query.created_at = { $gte: startOfDay, $lte: endOfDay };
    }

    const orders = await Order.find(query);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const getOrderById = async (req, res) => {
  try {
    const { order_id } = req.params;
    const query = { order_id };
    if (req.user.role === 'customer') {
      query.customer_id = req.user.user_id;
    } else if (req.user.role !== 'admin' && req.user.role !== 'staff') {
      return res.status(403).json({ error: 'Không có quyền truy cập.' });
    }
    const order = await Order.findOne(query).lean();
    if (!order) {
      return res.status(404).json({ error: 'Đơn hàng không tồn tại.' });
    }

    // Đảm bảo cost_details luôn có format chuẩn và đủ trường
    const defaultCostDetails = {
      distance_fee: {
        label: `Phí ship theo khoảng cách${order.distance ? ` (${Number(order.distance).toFixed(2)} km)` : ''}`,
        value: order.cost_details?.distance_fee?.value || order.distance_fee || 0
      },
      over_weight_fee: {
        label: 'Phí vượt cản',
        value: order.cost_details?.over_weight_fee?.value || order.over_weight_fee || 0
      },
      shipping_fee: {
        label: 'Cước phí giao hàng',
        value: order.cost_details?.shipping_fee?.value || order.shipping_fee || 0
      },
      service_fee: {
        label: 'Phí dịch vụ vận chuyển',
        value: order.cost_details?.service_fee?.value || order.service_fee || 0
      },
      packing_fee: {
        label: 'Phí đóng gói',
        value: order.cost_details?.packing_fee?.value || order.packing_fee || 0
      },
      surcharge: {
        label: 'Phụ thu',
        value: order.cost_details?.surcharge?.value || order.surcharge || 0
      },
      insurance_fee: {
        label: 'Phí bảo hiểm',
        value: order.cost_details?.insurance_fee?.value || order.insurance_fee || 0
      },
      platform_fee: {
        label: 'Phí nền tảng',
        value: order.cost_details?.platform_fee?.value || order.platform_fee || 0
      },
      overtime_fee: {
        label: 'Phí ngoài giờ',
        value: order.cost_details?.overtime_fee?.value || order.overtime_fee || 0
      },
      waiting_fee: {
        label: 'Phí chờ',
        value: order.cost_details?.waiting_fee?.value || order.waiting_fee || 0
      },
      discount: {
        label: 'Giảm giá',
        value: order.cost_details?.discount?.value || order.discount || 0
      },
      total_fee: {
        label: 'Tổng thanh toán',
        value: order.cost_details?.total_fee?.value || order.total_fee || 0
      }
    };
    // Nếu order.cost_details thiếu trường nào thì bổ sung
    order.cost_details = { ...defaultCostDetails, ...(order.cost_details || {}) };

    // Lấy thông tin đầy đủ của địa chỉ giao hàng từ UserAddress
    if (order.delivery_address_id) {
      const deliveryAddress = await UserAddress.findOne({ address_id: order.delivery_address_id }).lean();
      if (deliveryAddress) {
        order.delivery_address_full = deliveryAddress;
      }
    }

    // Lấy thông tin shipper nếu có shipper_id
    if (order.shipper_id) {
      const shipper = await User.findOne({ user_id: order.shipper_id });
      if (shipper) {
        order.shipper_info = {
          name: shipper.name || shipper.fullName || '',
          fullName: shipper.fullName || shipper.name || '',
          phone: shipper.phone || shipper.phoneNumber || '',
          phoneNumber: shipper.phoneNumber || shipper.phone || '',
          avatar: shipper.avatar || '',
          email: shipper.email || '',
          address: shipper.address || '',
          warehouse_id: shipper.warehouse_id || '',
          vehicle_info: shipper.vehicle_info || {},
          vehicleType: shipper.vehicleType || '',
          vehicleNumber: shipper.vehicleNumber || '',
          citizenId: shipper.citizenId || ''
        };
      } else {
        console.warn('Không tìm thấy shipper với user_id:', order.shipper_id);
      }
    }

    // Nếu có timeline/history, gắn thông tin shipper cho từng bước nếu có shipper_id
    if (Array.isArray(order.timeline)) {
      for (const step of order.timeline) {
        if (step.shipper_id) {
          const stepShipper = await User.findOne({ user_id: step.shipper_id });
          if (stepShipper) {
            step.shipper = {
              name: stepShipper.name,
              phone: stepShipper.phone,
              avatar: stepShipper.avatar || '',
              email: stepShipper.email || '',
              vehicle_info: stepShipper.vehicle_info || {}
            };
          }
        }
      }
    }

    // Lấy thông tin đánh giá nếu có
    const ratingDoc = await Rating.findOne({ order_id: order.order_id });
    if (ratingDoc) {
      order.rating = ratingDoc.rating;
      order.rating_comment = ratingDoc.comment;
      order.rating_tags = ratingDoc.tags || [];
      order.rating_images = ratingDoc.images || [];
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateOrder = async (req, res) => {
  try {
    const { order_id } = req.params;
    const query = { order_id };
    if (req.user.role === 'customer') {
      query.customer_id = req.user.user_id;
    } else if (req.user.role !== 'admin' && req.user.role !== 'staff') {
      return res.status(403).json({ error: 'Không có quyền truy cập.' });
    }

    const order = await Order.findOne(query);
    if (!order) {
      return res.status(404).json({ error: 'Đơn hàng không tồn tại.' });
    }

    // Chỉ cho phép cập nhật các trường được phép
    const allowedUpdates = [
      'status',
      'shipper_id',
      'pickup_time',
      'delivery_time',
      'delivered_at',
      'cancel_reason',
      'payment_status',
      'payment_method',
      'total_fee',
      'service_fee',
      'cost_details',
      'pickup_address',
      'delivery_address',
      'pickup_address_id',
      'delivery_address_id',
      'weight',
      'dimensions',
      'item_type',
      'order_items',
      'order_value',
      'estimate_time',
      'pickup_time_suggestion',
      'coupon_id',
      'is_suburban',
      'note',
      'description'
    ];

    const updates = {};
    for (const key in req.body) {
      if (allowedUpdates.includes(key)) {
        // Nếu là object address, merge từng trường, đảm bảo không mất trường cũ
        if ((key === 'pickup_address' || key === 'delivery_address') && typeof req.body[key] === 'object') {
          let original = {};
          if (order[key]) {
            if (typeof order[key].toObject === 'function') {
              original = order[key].toObject();
            } else if (order[key]._doc) {
              original = { ...order[key]._doc };
            } else {
              original = { ...order[key] };
            }
          }
          updates[key] = { ...original, ...req.body[key] };
        } else if (key === 'order_items' && Array.isArray(req.body[key]) && Array.isArray(order[key])) {
          // Chỉ cho phép cập nhật các trường con nhất định, ví dụ: description
          const allowedItemFields = ['description'];
          const mergedItems = order[key].map((oldItem) => {
            const oldObj = oldItem.toObject ? oldItem.toObject() : oldItem;
            const updateObj = req.body[key].find(i => i._id == oldObj._id);
            if (updateObj) {
              // Chỉ merge các trường được phép
              const filteredUpdate = {};
              for (const f of allowedItemFields) {
                if (updateObj.hasOwnProperty(f)) filteredUpdate[f] = updateObj[f];
              }
              return { ...oldObj, ...filteredUpdate };
            }
            return oldObj;
          });
          updates[key] = mergedItems;
        } else {
          updates[key] = req.body[key];
        }
      }
    }

    // Cập nhật thời gian
    updates.updated_at = new Date();

    // Cập nhật đơn hàng
    Object.assign(order, updates);
    await order.save();

    res.json({ message: 'Cập nhật đơn hàng thành công.', order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

router.put('/:order_id/status', async (req, res) => {
  try {
    const { order_id } = req.params;
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Vui lòng cung cấp status.' });
    }
    const order = await Order.findOne({ order_id });
    if (!order) {
      return res.status(404).json({ error: 'Đơn hàng không tồn tại.' });
    }
    if (req.user.role === 'shipper' && order.shipper_id !== req.user.user_id) {
      return res.status(403).json({ error: 'Không có quyền cập nhật trạng thái cho đơn hàng này.' });
    }

    // Kiểm soát quy trình chuyển trạng thái (chặt chẽ, không phân biệt hoa thường)
    const statusFlow = ['pending', 'preparing', 'delivering', 'delivered'];
    const currentStatus = String(order.status).toLowerCase().trim();
    const nextStatus = String(status).toLowerCase().trim();
    const currentIndex = statusFlow.indexOf(currentStatus);
    const nextIndex = statusFlow.indexOf(nextStatus);

    console.log('Shipper:', req.user.user_id, 'Order:', order_id, 'Current:', currentStatus, 'Next:', nextStatus);

    if (currentIndex === -1 || nextIndex === -1) {
      return res.status(400).json({ error: 'Trạng thái không hợp lệ. Chỉ chấp nhận: pending, preparing, delivering, delivered.' });
    }
    if (nextIndex === currentIndex) {
      return res.status(400).json({ error: 'Trạng thái mới phải khác trạng thái hiện tại.' });
    }
    // Không cho phép bỏ qua bước
    if (nextIndex > currentIndex + 1) {
      if (currentStatus === 'pending' && nextStatus === 'delivering') {
        return res.status(400).json({ error: 'Đơn hàng chưa được chuẩn bị. Vui lòng quét mã QR để chuyển sang trạng thái "Đang chuẩn bị".' });
      }
      if (currentStatus === 'preparing' && nextStatus === 'delivered') {
        return res.status(400).json({ error: 'Đơn hàng chưa được giao, không thể xác nhận hoàn thành đơn.' });
      }
      return res.status(400).json({ error: 'Không thể chuyển trạng thái vượt quá quy trình.' });
    }
    // Không cho phép lùi trạng thái
    if (nextIndex < currentIndex) {
      return res.status(400).json({ error: 'Không thể quay lại trạng thái trước.' });
    }

    order.status = nextStatus;
    if (nextStatus === 'delivered') {
      order.delivered_at = new Date();
    }
    order.updated_at = new Date();
    await order.save();
    res.json({ message: 'Cập nhật trạng thái đơn hàng thành công.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:order_id/assign-shipper', async (req, res) => {
  try {
    const { order_id } = req.params;
    const { shipper_id } = req.body;

    if (!['admin', 'staff'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Không có quyền gán shipper cho đơn hàng.' });
    }

    const order = await Order.findOne({ order_id });
    if (!order) {
      return res.status(404).json({ error: 'Đơn hàng không tồn tại.' });
    }

    const shipper = await User.findOne({ user_id: shipper_id, role: 'shipper' });
    if (!shipper) {
      return res.status(404).json({ error: 'Shipper không tồn tại.' });
    }

    if (!shipper.warehouse_id || shipper.warehouse_id !== order.warehouse_id) {
      return res.status(400).json({ error: 'Shipper không thuộc kho của đơn hàng này.' });
    }

    order.shipper_id = shipper_id;
    await order.save();

    res.json({ message: 'Gán shipper vào đơn hàng thành công.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = {
  getOrderById,
  updateOrder
};