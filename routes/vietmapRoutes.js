const express = require('express');
const router = express.Router();
const axios = require('axios');
const subvn = require('sub-vn');

// Get place details from Vietmap API
router.get('/place-details', async (req, res) => {
    try {
        const { place_id } = req.query;
        if (!place_id) {
            return res.status(400).json({ error: 'Place ID is required' });
        }

        const response = await axios.get(`https://maps.vietmap.vn/api/place/details/json`, {
            params: {
                place_id,
                key: process.env.VIETMAP_API_KEY
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error('Error fetching place details:', error);
        res.status(500).json({ error: 'Failed to fetch place details' });
    }
});

// Search places using Vietmap API
router.get('/search', async (req, res) => {
    try {
        const { query, location } = req.query;
        if (!query) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        const response = await axios.get(`https://maps.vietmap.vn/api/place/textsearch/json`, {
            params: {
                query,
                location,
                key: process.env.VIETMAP_API_KEY
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error('Error searching places:', error);
        res.status(500).json({ error: 'Failed to search places' });
    }
});

// Get directions using Vietmap API
router.get('/directions', async (req, res) => {
    try {
        const { origin, destination } = req.query;
        if (!origin || !destination) {
            return res.status(400).json({ error: 'Origin and destination are required' });
        }

        const response = await axios.get(`https://maps.vietmap.vn/api/directions/json`, {
            params: {
                origin,
                destination,
                key: process.env.VIETMAP_API_KEY
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error('Error getting directions:', error);
        res.status(500).json({ error: 'Failed to get directions' });
    }
});

const VIETMAP_API_KEY = process.env.VIETMAP_API_KEY || '7f9ef35866466886ebd24ba5091eda803732c8c76cde1b4a';

// Proxy Autocomplete
router.get('/autocomplete', async (req, res) => {
  try {
    const { text } = req.query;
    if (!text) {
      return res.status(400).json({ error: 'Text parameter is required.' });
    }
    const response = await axios.get('https://maps.vietmap.vn/api/autocomplete/v3', {
      params: {
        apikey: VIETMAP_API_KEY,
        text,
      }
    });
    res.json(response.data);
  } catch (err) {
    console.error('VietMap Autocomplete error:', err.response?.data || err.message);
    res.status(500).json({ error: 'VietMap Autocomplete error', detail: err.response?.data || err.message });
  }
});

// Proxy Place
router.get('/place', async (req, res) => {
  try {
    const { refid } = req.query;
    if (!refid) {
      return res.status(400).json({ error: 'Refid parameter is required.' });
    }
    const response = await axios.get('https://maps.vietmap.vn/api/place/v3', {
      params: {
        apikey: VIETMAP_API_KEY,
        refid,
      }
    });
    res.json(response.data);
  } catch (err) {
    console.error('VietMap Place error:', err.message);
    res.status(500).json({ error: 'VietMap Place error', detail: err.message });
  }
});

const ORS_API_KEY = '5b3ce3597851110001cf6248e3e8ef34ed2b4788a48fd77f04a52ca1';

// Bảng ánh xạ tên tỉnh Việt Nam sang tên quốc tế cho ORS
const provinceNameMap = {
  'Hà Nội': 'Hanoi',
  'TP. Hồ Chí Minh': 'Ho Chi Minh City',
  'Thành phố Hồ Chí Minh': 'Ho Chi Minh City',
  'Đà Nẵng': 'Da Nang',
  'Cần Thơ': 'Can Tho',
  'Hải Phòng': 'Hai Phong',
  'Thừa Thiên Huế': 'Thua Thien Hue',
  // ... có thể bổ sung thêm nếu cần ...
};

// Hàm bỏ dấu tiếng Việt
function removeVietnameseTones(str) {
  return str.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

// Bảng lat/lng trung tâm cho 63 tỉnh/thành phố Việt Nam
const provinceLatLng = {
  '01': { lat: 21.028511, lng: 105.804817 }, // Hà Nội
  '79': { lat: 10.776889, lng: 106.700806 }, // TP.HCM
  '48': { lat: 16.047079, lng: 108.206230 }, // Đà Nẵng
  '31': { lat: 20.844911, lng: 106.688084 }, // Hải Phòng
  '92': { lat: 10.045162, lng: 105.746857 }, // Cần Thơ
  '54': { lat: 16.463713, lng: 107.590866 }, // Thừa Thiên Huế
  '02': { lat: 22.396428, lng: 104.048012 }, // Hà Giang
  '04': { lat: 22.485074, lng: 103.970524 }, // Cao Bằng
  '06': { lat: 21.857939, lng: 106.761519 }, // Bắc Kạn
  '08': { lat: 22.093823, lng: 105.229211 }, // Tuyên Quang
  '10': { lat: 21.594222, lng: 105.848705 }, // Lào Cai
  '11': { lat: 21.213598, lng: 104.006988 }, // Điện Biên
  '12': { lat: 21.326983, lng: 103.914399 }, // Lai Châu
  '14': { lat: 21.588155, lng: 104.043887 }, // Sơn La
  '15': { lat: 21.776724, lng: 104.870872 }, // Yên Bái
  '17': { lat: 21.299144, lng: 105.715246 }, // Hoà Bình
  '19': { lat: 21.594222, lng: 105.848705 }, // Thái Nguyên
  '20': { lat: 21.594222, lng: 105.848705 }, // Lạng Sơn
  '22': { lat: 21.594222, lng: 105.848705 }, // Quảng Ninh
  '24': { lat: 21.594222, lng: 105.848705 }, // Bắc Giang
  '25': { lat: 21.594222, lng: 105.848705 }, // Phú Thọ
  '26': { lat: 21.594222, lng: 105.848705 }, // Vĩnh Phúc
  '27': { lat: 21.594222, lng: 105.848705 }, // Bắc Ninh
  '30': { lat: 20.844911, lng: 106.688084 }, // Hải Dương
  '33': { lat: 20.844911, lng: 106.688084 }, // Hưng Yên
  '34': { lat: 20.844911, lng: 106.688084 }, // Thái Bình
  '35': { lat: 20.844911, lng: 106.688084 }, // Hà Nam
  '36': { lat: 20.844911, lng: 106.688084 }, // Nam Định
  '37': { lat: 20.844911, lng: 106.688084 }, // Ninh Bình
  '38': { lat: 19.807087, lng: 105.776333 }, // Thanh Hóa
  '40': { lat: 19.807087, lng: 105.776333 }, // Nghệ An
  '42': { lat: 18.666624, lng: 105.690449 }, // Hà Tĩnh
  '44': { lat: 17.594839, lng: 106.348747 }, // Quảng Bình
  '45': { lat: 16.818543, lng: 107.094395 }, // Quảng Trị
  '46': { lat: 16.463713, lng: 107.590866 }, // Thừa Thiên Huế
  '49': { lat: 15.275185, lng: 108.799566 }, // Quảng Nam
  '51': { lat: 15.008864, lng: 108.644286 }, // Quảng Ngãi
  '52': { lat: 14.351383, lng: 108.000145 }, // Kon Tum
  '54': { lat: 13.965007, lng: 108.017882 }, // Gia Lai
  '56': { lat: 12.666389, lng: 108.037750 }, // Đắk Lắk
  '58': { lat: 12.238791, lng: 109.196749 }, // Khánh Hòa
  '60': { lat: 11.932650, lng: 108.438438 }, // Lâm Đồng
  '62': { lat: 11.265520, lng: 106.365682 }, // Bình Phước
  '64': { lat: 10.980400, lng: 106.651900 }, // Tây Ninh
  '66': { lat: 10.980400, lng: 106.651900 }, // Bình Dương
  '67': { lat: 10.980400, lng: 106.651900 }, // Đồng Nai
  '68': { lat: 10.980400, lng: 106.651900 }, // Bà Rịa - Vũng Tàu
  '70': { lat: 10.980400, lng: 106.651900 }, // Long An
  '72': { lat: 10.980400, lng: 106.651900 }, // Tiền Giang
  '74': { lat: 10.980400, lng: 106.651900 }, // Bến Tre
  '75': { lat: 10.980400, lng: 106.651900 }, // Trà Vinh
  '77': { lat: 10.980400, lng: 106.651900 }, // Vĩnh Long
  '78': { lat: 10.980400, lng: 106.651900 }, // Đồng Tháp
  '80': { lat: 10.980400, lng: 106.651900 }, // An Giang
  '82': { lat: 10.980400, lng: 106.651900 }, // Kiên Giang
  '83': { lat: 10.980400, lng: 106.651900 }, // Cà Mau
  '84': { lat: 10.980400, lng: 106.651900 }, // Bạc Liêu
  '86': { lat: 10.980400, lng: 106.651900 }, // Sóc Trăng
  '87': { lat: 10.980400, lng: 106.651900 }, // Hậu Giang
  '89': { lat: 10.980400, lng: 106.651900 }, // Ninh Thuận
  '91': { lat: 10.980400, lng: 106.651900 }, // Bình Thuận
  '93': { lat: 10.980400, lng: 106.651900 }, // Bình Định
  '94': { lat: 10.980400, lng: 106.651900 }, // Phú Yên
  '95': { lat: 10.980400, lng: 106.651900 }, // Quảng Bình
  '96': { lat: 10.980400, lng: 106.651900 }, // Quảng Trị
};

function getLatLngFromProvinceCode(provinceCode) {
  return provinceLatLng[provinceCode] || { lat: 21.028511, lng: 105.804817 }; // fallback Hà Nội
}

function getProvinceNameForORS(code) {
  const province = subvn.getProvinces().find(p => p.code === code);
  if (!province) return '';
  let name = province.name.replace(/^Tỉnh |^Thành phố |^TP\. /i, '');
  if (provinceNameMap[name]) return provinceNameMap[name] + ', Vietnam';
  return removeVietnameseTones(name) + ', Vietnam';
}

// Hàm lấy tên tỉnh từ mã
function getProvinceName(code) {
  const province = subvn.getProvinces().find(p => p.code === code);
  return province ? province.name : '';
}

// Hàm geocode địa chỉ sang lat/lng bằng ORS
async function geocodeORS(address) {
  const url = `https://api.openrouteservice.org/geocode/search?api_key=${ORS_API_KEY}&text=${encodeURIComponent(address)}`;
  const response = await axios.get(url);
  if (!response.data.features.length) throw new Error('Không tìm được tọa độ cho địa chỉ: ' + address);
  const coords = response.data.features[0].geometry.coordinates; // [lng, lat]
  return { lng: coords[0], lat: coords[1] };
}

// Hàm tính khoảng cách thực tế bằng ORS
async function getORSRouteDistance(start, end) {
  const url = 'https://api.openrouteservice.org/v2/directions/driving-car';
  const body = {
    coordinates: [
      [start.lng, start.lat],
      [end.lng, end.lat]
    ]
  };
  const headers = {
    'Authorization': ORS_API_KEY,
    'Content-Type': 'application/json'
  };
  const response = await axios.post(url, body, { headers });
  if (!response.data.features || !response.data.features[0] || !response.data.features[0].properties.summary) throw new Error('ORS không trả về route hợp lệ');
  const distanceMeters = response.data.features[0].properties.summary.distance;
  return distanceMeters / 1000; // km
}

// Hàm tính khoảng cách địa lý (chim bay) giữa 2 điểm lat/lng
function haversineDistance(lat1, lng1, lat2, lng2) {
  function toRad(x) { return x * Math.PI / 180; }
  const R = 6371; // bán kính Trái Đất (km)
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Route duy nhất: tính phí giao hàng từ tỉnh gửi/nhận
router.post('/calc-shipping-fee', async (req, res) => {
  try {
    const { sender, receiver } = req.body;
    if (!sender || !receiver || !sender.province || !receiver.province) {
      return res.status(400).json({ error: 'Thiếu mã tỉnh gửi hoặc nhận' });
    }
    // Nếu cùng tỉnh thì trả về phí 20k và distance_km = 0
    if (sender.province === receiver.province) {
      return res.json({ distance_km: 0, fee: 20000 });
    }
    const senderCoord = getLatLngFromProvinceCode(sender.province);
    const receiverCoord = getLatLngFromProvinceCode(receiver.province);
    let distance_km = 0;
    try {
      distance_km = await getORSRouteDistance(senderCoord, receiverCoord);
    } catch (e) {
      distance_km = haversineDistance(senderCoord.lat, senderCoord.lng, receiverCoord.lat, receiverCoord.lng);
    }
    if (!distance_km || isNaN(distance_km)) {
      return res.status(400).json({ error: 'Không thể tính được khoảng cách giữa hai địa chỉ này!' });
    }
    let fee = 0;
    if (distance_km <= 100) fee = 20000;
    else if (distance_km <= 300) fee = 30000;
    else if (distance_km <= 500) fee = 40000;
    else if (distance_km <= 700) fee = 50000;
    else if (distance_km <= 1000) fee = 60000;
    else fee = 75000;
    res.json({ distance_km: +distance_km.toFixed(2), fee });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;