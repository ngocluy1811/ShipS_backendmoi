require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const app = express();
const http = require('http');
const { initSocket } = require('./socket');


mongoose.set('strictQuery', true);

// Kết nối đến MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://nndminh03:psrMirsKkv19Yia6@ships-cluster.guijyap.mongodb.net/ships_db', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('MongoDB Atlas connected');
  // Import tất cả models để đảm bảo chúng được đăng ký
  require('./models/User');
  require('./models/UserAddress');
  require('./models/UserCoupon');
  require('./models/Coupon');
  require('./models/Notification');
  require('./models/Rating');
  require('./models/Order');
  require('./models/OrderItem');
  require('./models/Warehouse');
  require('./models/CarTransport');
  require('./models/GroupOrder');
  require('./models/TransferScript');
  require('./models/Tracking');
  require('./models/Payment');
  require('./models/CustomerCost');
  require('./models/Salary');
  require('./models/Product');
})
.catch(err => console.error('MongoDB Atlas connection error:', err));

// Export connections để sử dụng trong các models (chỉ export mongoose cho Atlas)
module.exports = mongoose;

app.use(express.json());
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

const authenticateToken = (roles) => (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Không có token.' });
  }
  jwt.verify(token, 'your_jwt_secret', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token không hợp lệ.' });
    }
    if (roles && !roles.includes(user.role)) {
      return res.status(403).json({ error: 'Không có quyền truy cập.' });
    }
    req.user = user;
    next();
  });
};

// Hàm tính khoảng cách thực tế bằng Google Maps API
const calculateDistance = async (pickupAddress, deliveryAddress) => {
  try {
    const pickup = `${pickupAddress.street}, ${pickupAddress.ward}, ${pickupAddress.district}, ${pickupAddress.city}`;
    const delivery = `${deliveryAddress.street}, ${deliveryAddress.ward}, ${deliveryAddress.district}, ${deliveryAddress.city}`;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      console.log('Không có Google Maps API key, sử dụng phương pháp tính khoảng cách mô phỏng');
      return calculateDistanceFallback(pickupAddress, deliveryAddress);
    }

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(pickup)}&destinations=${encodeURIComponent(delivery)}&key=${apiKey}`;
    console.log('Gọi Google Maps API với URL:', url);

    const response = await axios.get(url);
    const data = response.data;
    console.log('Phản hồi từ Google Maps API:', data);

    if (data.status === 'OK' && data.rows[0].elements[0].status === 'OK') {
      const distanceInMeters = data.rows[0].elements[0].distance.value;
      console.log(`Khoảng cách tính được: ${distanceInMeters / 1000} km`);
      return distanceInMeters / 1000; // Chuyển đổi từ mét sang km
    } else {
      console.log('Phản hồi từ Google Maps API không thành công:', data.status, data.rows[0]?.elements[0]?.status);
      return calculateDistanceFallback(pickupAddress, deliveryAddress);
    }
  } catch (error) {
    console.error('Lỗi khi gọi Google Maps API:', error.message, error.response?.data || '');
    return calculateDistanceFallback(pickupAddress, deliveryAddress);
  }
};

// Logic mô phỏng tính khoảng cách nếu Google Maps API không hoạt động
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

    const northCities = [
      'Hà Nội', 'Hải Phòng', 'Bắc Giang', 'Bắc Kạn', 'Bắc Ninh', 'Cao Bằng', 'Điện Biên', 
      'Hà Giang', 'Hà Nam', 'Hà Tĩnh', 'Hải Dương', 'Hòa Bình', 'Hưng Yên', 'Lai Châu', 
      'Lạng Sơn', 'Lào Cai', 'Nam Định', 'Nghệ An', 'Ninh Bình', 'Phú Thọ', 'Quảng Ninh', 
      'Sơn La', 'Thái Bình', 'Thái Nguyên', 'Thanh Hóa', 'Tuyên Quang', 'Vĩnh Phúc', 'Yên Bái'
    ];
    const centralCities = [
      'Đà Nẵng', 'Bình Định', 'Đắk Lắk', 'Đắk Nông', 'Gia Lai', 'Hà Tĩnh', 'Khánh Hòa', 
      'Kon Tum', 'Lâm Đồng', 'Nghệ An', 'Phú Yên', 'Quảng Bình', 'Quảng Nam', 'Quảng Ngãi', 
      'Quảng Trị', 'Thanh Hóa', 'Thừa Thiên Huế'
    ];
    const southCities = [
      'TP.HCM', 'Bình Dương', 'Bà Rịa - Vũng Tàu', 'Bạc Liêu', 'Bến Tre', 'Cà Mau', 
      'Cần Thơ', 'Đồng Nai', 'Đồng Tháp', 'Hậu Giang', 'Kiên Giang', 'Long An', 'Sóc Trăng', 
      'Tây Ninh', 'Tiền Giang', 'Trà Vinh', 'Vĩnh Long', 'An Giang'
    ];

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
    return 50;
  }
};

// Hàm tính phí vận chuyển
const calculateShippingFee = (weight, dimensions, distance, service_type, is_suburban, order_value = 0) => {
  let regionType = 'intra_province';
  if (distance > 30) {
    regionType = distance > 100 ? 'inter_region' : 'same_region';
  }

  let baseFee, additionalFeePerKg;
  if (regionType === 'intra_province') {
    baseFee = 22000;
    additionalFeePerKg = 2500;
  } else if (regionType === 'same_region') {
    baseFee = 30000;
    additionalFeePerKg = 5000;
  } else {
    baseFee = 35000;
    additionalFeePerKg = 6000;
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

// Hàm dự đoán thời gian giao hàng
const estimateDeliveryTime = (distance, service_type) => {
  let deliveryTime;

  if (service_type === 'standard') {
    if (distance <= 30) {
      deliveryTime = "1-2 ngày";
    } else if (distance <= 100) {
      deliveryTime = "2-3 ngày";
    } else if (distance <= 800) {
      deliveryTime = "3-5 ngày";
    } else {
      deliveryTime = "5-7 ngày";
    }
  } else if (service_type === 'expedited') {
    if (distance <= 30) {
      deliveryTime = "trong ngày";
    } else if (distance <= 100) {
      deliveryTime = "1-2 ngày";
    } else if (distance <= 800) {
      deliveryTime = "2-3 ngày";
    } else {
      deliveryTime = "3-4 ngày";
    }
  } else if (service_type === 'express') {
    if (distance <= 30) {
      deliveryTime = "vài giờ";
    } else if (distance <= 100) {
      deliveryTime = "trong ngày";
    } else if (distance <= 800) {
      deliveryTime = "1 ngày";
    } else {
      deliveryTime = "1-2 ngày";
    }
  } else {
    deliveryTime = "không xác định (vui lòng chọn loại hình giao hàng: standard, expedited, hoặc express)";
  }

  return deliveryTime;
};

// Thông tin dự án ShipS
const projectInfo = {
  name: "ShipS",
  goal: "Cung cấp dịch vụ giao hàng tiện lợi toàn quốc, nhanh chóng, thông minh với nhiều ưu đãi, hỗ trợ khách hàng tối đa trong việc vận chuyển hàng hóa.",
  features: {
    basic: [
      "Đăng ký tài khoản (khách hàng, shipper, nhân viên).",
      "Đăng nhập/đăng xuất tài khoản.",
      "Quản lý thông tin cá nhân (cập nhật, đổi mật khẩu).",
      "Tạo đơn hàng (khách hàng).",
      "Xem chi tiết đơn hàng (khách hàng, shipper, nhân viên).",
      "Theo dõi trạng thái đơn hàng (khách hàng, shipper).",
      "Quản lý kho (nhân viên).",
      "Gán shipper cho đơn hàng (nhân viên)."
    ],
    advanced: [
      "Tính toán chi phí giao hàng dựa trên khoảng cách, trọng lượng, kích thước và loại hình giao hàng (giao thường, giao nhanh, hỏa tốc).",
      "Ước lượng thời gian giao hàng dựa trên loại hình giao hàng và khoảng cách.",
      "Tích hợp mã QR để theo dõi đơn hàng.",
      "Tích hợp Google Maps để tính khoảng cách thực tế.",
      "Quản lý mã giảm giá (coupon) và áp dụng khi tạo đơn hàng.",
      "Hỗ trợ thanh toán qua ZaloPay.",
      "Gửi thông báo trạng thái đơn hàng qua email hoặc ứng dụng.",
      "Hỗ trợ AI tư vấn lộ trình giao hàng, chi phí, thời gian giao hàng, và các vấn đề khác."
    ],
    support: [
      "Hỗ trợ khách hàng qua chatbot AI (tư vấn chi phí, thời gian, loại hình giao hàng, đổi mật khẩu, v.v.).",
      "Liên hệ qua hotline (1900xxxx) hoặc email (support@ships.com.vn).",
      "Giải đáp thắc mắc kỹ thuật (vấn đề đăng nhập, lỗi hệ thống, v.v.)."
    ]
  },
  contact: {
    hotline: "1900xxxx",
    email: "support@ships.com.vn"
  }
};

// Endpoint để gọi Gemini API và trả lời câu hỏi (không cần xác thực token)
app.post('/api/support', async (req, res) => {
  try {
    const { question, context } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Vui lòng cung cấp câu hỏi.' });
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API Key của Google không được cung cấp.' });
    }

    // Kiểm tra thông tin cần thiết để tính toán chi phí (nếu câu hỏi liên quan đến chi phí hoặc thời gian giao hàng)
    let shippingDetails = null;
    let deliveryOptions = null;
    if (context?.pickup_address && context?.delivery_address && context?.weight && context?.dimensions && context?.service_type) {
      const distance = await calculateDistance(context.pickup_address, context.delivery_address);
      const fees = calculateShippingFee(
        context.weight,
        context.dimensions,
        distance,
        context.service_type,
        context.is_suburban,
        context.order_value
      );
      const deliveryTime = estimateDeliveryTime(distance, context.service_type);
      shippingDetails = {
        distance: distance,
        shipping_fee: fees.shipping_fee,
        additional_fees: fees.additional_fees,
        total_fee: fees.shipping_fee + fees.additional_fees.total_additional,
        delivery_time: deliveryTime
      };

      // Tính chi phí và thời gian cho các loại hình giao hàng khác để tư vấn
      const standardFees = calculateShippingFee(context.weight, context.dimensions, distance, 'standard', context.is_suburban, context.order_value);
      const expeditedFees = calculateShippingFee(context.weight, context.dimensions, distance, 'expedited', context.is_suburban, context.order_value);
      const expressFees = calculateShippingFee(context.weight, context.dimensions, distance, 'express', context.is_suburban, context.order_value);
      deliveryOptions = {
        standard: {
          total_fee: standardFees.shipping_fee + standardFees.additional_fees.total_additional,
          delivery_time: estimateDeliveryTime(distance, 'standard')
        },
        expedited: {
          total_fee: expeditedFees.shipping_fee + expeditedFees.additional_fees.total_additional,
          delivery_time: estimateDeliveryTime(distance, 'expedited')
        },
        express: {
          total_fee: expressFees.shipping_fee + expressFees.additional_fees.total_additional,
          delivery_time: estimateDeliveryTime(distance, 'express')
        }
      };
    }

    // Gọi Gemini API với prompt chi tiết
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
    const response = await axios.post(url, {
      contents: [
        {
          parts: [
            {
              text: `You are an AI assistant for the ShipS project, a nationwide delivery service in Vietnam. Answer questions in a natural, friendly, and professional tone, as if you were a customer support agent. Use the provided project information, shipping details, and delivery options to answer accurately. The project information includes the project's name, goal, features, and contact details. Features are categorized into basic, advanced, and support functionalities. If the user asks about shipping costs or times, use the shipping details and delivery options to provide precise answers. If the user asks for advice on shipping types, suggest the best option based on cost and delivery time. If the user asks about changing passwords, technical issues, or contact information, use the project information to guide them. If the user asks about something not covered in the context, politely ask for more information or provide a general response based on your knowledge.

Project Information: ${JSON.stringify(projectInfo)}.
Context: ${JSON.stringify({ ...context, shippingDetails, deliveryOptions })}.
Question: ${question}`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0,
        topP: 0.95,
        topK: 64,
        maxOutputTokens: 8192,
        responseMimeType: "text/plain"
      }
    });

    const answer = response.data.candidates[0].content.parts[0].text;
    res.json({ answer });
  } catch (error) {
    console.error('Lỗi khi gọi Gemini API:', error.message, error.response?.data || '');
    res.status(500).json({ error: 'Không thể lấy câu trả lời từ Gemini API.' });
  }
});

// Import routers
const userRouter = require('./controllers/userController');
const userAddressRouter = require('./controllers/userAddressController');
const userCouponRouter = require('./controllers/userCouponController');
const couponRouter = require('./controllers/couponController');
const notificationRouter = require('./routes/notificationRoutes');
const ratingRouter = require('./controllers/ratingController');
const orderRouter = require('./routes/orderRoutes');
const orderItemRouter = require('./controllers/orderItemController');
const warehouseRouter = require('./controllers/warehouseController');
const carTransportRouter = require('./controllers/carTransportController');
const groupOrderRouter = require('./controllers/groupOrderController');
const transferScriptRouter = require('./controllers/transferScriptController');
const trackingRouter = require('./controllers/trackingController');
const paymentRouter = require('./controllers/paymentController');
const customerCostRouter = require('./controllers/customerCostController');
const salaryRouter = require('./controllers/salaryController');
const productRouter = require('./routes/productRoutes');
const deliveryRouter = require('./routes/deliveryRoutes');
const vietmapRoutes = require('./routes/vietmapRoutes');

// Public routes (không yêu cầu token)
app.use('/api/users', userRouter);
app.use('/api/products', productRouter);

// Protected routes (yêu cầu token)
app.use('/api/user-addresses', authenticateToken(['customer', 'admin', 'staff', 'shipper']), userAddressRouter);
app.use('/api/user-coupons', authenticateToken(['customer', 'admin', 'staff']), userCouponRouter);
app.use('/api/coupons', authenticateToken(['admin']), couponRouter);
app.use('/api/notifications', authenticateToken(['admin', 'staff', 'customer', 'shipper']), notificationRouter);
app.use('/api/ratings', authenticateToken(['customer']), ratingRouter);
app.use('/api/orders', authenticateToken(['admin', 'staff', 'customer', 'shipper']), orderRouter);
app.use('/api/order-items', authenticateToken(['admin', 'staff', 'customer']), orderItemRouter);
app.use('/api/warehouses', authenticateToken(['admin', 'staff', 'customer']), warehouseRouter);
app.use('/api/cars', authenticateToken(['admin']), carTransportRouter);
app.use('/api/group-orders', authenticateToken(['admin']), groupOrderRouter);
app.use('/api/transfer-scripts', authenticateToken(['admin']), transferScriptRouter);
app.use('/api/trackings', authenticateToken(['shipper']), trackingRouter);
app.use('/api/payments', authenticateToken(['admin', 'staff', 'customer']), paymentRouter);
app.use('/api/customer-cost', authenticateToken(['admin', 'staff', 'customer']), customerCostRouter);
app.use('/api/salaries', authenticateToken(['admin', 'staff', 'shipper']), salaryRouter);
app.use('/api/delivery', deliveryRouter);
app.use('/api/vietmap', vietmapRoutes);

// Thêm route tạo thanh toán Momo giả lập trực tiếp vào app
// app.post('/api/momo/create-payment', (req, res) => {
//   // TODO: Tích hợp Momo thực tế ở đây
//   // Trả về link thanh toán giả lập để FE test
//   res.json({ payUrl: 'https://momo.vn/fake-payment-url' });
// });

app.post('/momo/create-payment', (req, res) => {
  res.json({ payUrl: 'https://momo.vn/fake-payment-url' });
});

const server = http.createServer(app);
initSocket(server);

server.listen(3000, () => console.log('Server running on port 3000 (with socket.io)'));