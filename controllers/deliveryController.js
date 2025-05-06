const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

exports.calculateDeliveryCost = async (req, res) => {
  try {
    const { origin, destination } = req.body;

    if (!origin || !destination) {
      return res.status(400).json({ error: 'Vui lòng cung cấp điểm xuất phát và điểm đến.' });
    }

    // Gọi Google Maps Directions API
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=driving&key=${apiKey}`;

    const response = await axios.get(url);
    const data = response.data;

    if (data.status !== 'OK') {
      return res.status(400).json({ error: `Không thể tính tuyến đường: ${data.status}` });
    }

    // Lấy khoảng cách (mét) và thời gian (giây)
    const route = data.routes[0].legs[0];
    const distanceInMeters = route.distance.value; // Mét
    const durationInSeconds = route.duration.value; // Giây

    // Chuyển đổi sang km và phút
    const distanceInKm = distanceInMeters / 1000;
    const durationInMinutes = durationInSeconds / 60;

    // Tính giá vận chuyển (ví dụ: 10,000 VNĐ/km + 500 VNĐ/phút)
    const costPerKm = 10000;
    const costPerMinute = 500;
    const cost = distanceInKm * costPerKm + durationInMinutes * costPerMinute;

    // Trả về kết quả
    res.status(200).json({
      distance: distanceInKm,
      duration: durationInMinutes,
      cost: cost,
      route: route.overview_polyline.points // Đường dẫn tuyến đường (dùng để hiển thị trên bản đồ nếu cần)
    });
  } catch (error) {
    console.error('Lỗi khi gọi Google Maps API:', error.message);
    res.status(500).json({ error: 'Lỗi khi tính giá vận chuyển.' });
  }
};