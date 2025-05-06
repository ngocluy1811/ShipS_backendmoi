const express = require('express');
const router = express.Router();
const UserAddress = require('../models/UserAddress');

router.post('/', async (req, res) => {
  try {
    const { user_id, street, ward, district, city, is_default } = req.body;
    if (!user_id || !street || !ward || !district || !city) {
      return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ các trường bắt buộc.' });
    }
    if (req.user.user_id !== user_id) {
      return res.status(403).json({ error: 'Không có quyền tạo địa chỉ cho người dùng khác.' });
    }
    const userAddress = new UserAddress({
      address_id: `address_${Date.now()}`,
      user_id,
      street,
      ward,
      district,
      city,
      is_default: is_default || false
    });
    await userAddress.save();
    res.json({ message: 'Tạo địa chỉ thành công.', address_id: userAddress.address_id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const addresses = await UserAddress.find({ user_id: req.user.user_id });
    res.json(addresses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;