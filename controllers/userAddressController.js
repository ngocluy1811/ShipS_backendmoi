const express = require('express');
const router = express.Router();
const UserAddress = require('../models/UserAddress');
const User = require('../models/User'); // Thêm import User

// Tạo địa chỉ mới
router.post('/', async (req, res) => {
  try {
    const { user_id, street, ward, district, city, is_default, label, name, phone, type } = req.body;
    if (!['customer', 'admin', 'staff', 'shipper'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Không có quyền tạo địa chỉ.' });
    }
    if (req.user.role === 'customer' && user_id !== req.user.user_id) {
      return res.status(403).json({ error: 'Không có quyền tạo địa chỉ cho người dùng khác.' });
    }
    if (!user_id || !street || !ward || !district || !city) {
      return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ các trường bắt buộc.' });
    }
    const user = await User.findOne({ user_id });
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại.' });
    }
    const userAddress = new UserAddress({
      address_id: `address_${Date.now()}`,
      user_id,
      label,
      name,
      phone,
      street,
      ward,
      district,
      city,
      is_default: is_default || false,
      type: type || 'delivery'
    });
    if (is_default) {
      await UserAddress.updateMany(
        { user_id, type: type || 'delivery', address_id: { $ne: userAddress.address_id } },
        { $set: { is_default: false } }
      );
    }
    await userAddress.save();
    res.json({ message: 'Tạo địa chỉ thành công.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Xem danh sách địa chỉ
router.get('/', async (req, res) => {
  try {
    const query = {};
    if (req.user.role === 'customer') {
      query.user_id = req.user.user_id;
    } else if (req.user.role !== 'admin' && req.user.role !== 'staff') {
      return res.status(403).json({ error: 'Không có quyền truy cập.' });
    }
    const addresses = await UserAddress.find(query);
    res.json(addresses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cập nhật địa chỉ
router.put('/:address_id', async (req, res) => {
  try {
    const { address_id } = req.params;
    const { street, ward, district, city, is_default, label, name, phone, type } = req.body;
    const address = await UserAddress.findOne({ address_id, user_id: req.user.user_id });
    if (!address) {
      return res.status(404).json({ error: 'Địa chỉ không tồn tại.' });
    }
    if (street) address.street = street;
    if (ward) address.ward = ward;
    if (district) address.district = district;
    if (city) address.city = city;
    if (label !== undefined) address.label = label;
    if (name !== undefined) address.name = name;
    if (phone !== undefined) address.phone = phone;
    if (type) address.type = type;
    if (is_default !== undefined) {
      if (is_default) {
        // Đặt tất cả địa chỉ khác của user cùng loại type thành không mặc định
        await UserAddress.updateMany(
          { user_id: req.user.user_id, type: address.type, address_id: { $ne: address_id } },
          { $set: { is_default: false } }
        );
        address.is_default = true;
      } else {
        address.is_default = false;
      }
    }
    await address.save();
    res.json({ message: 'Cập nhật địa chỉ thành công.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Xóa địa chỉ
router.delete('/:address_id', async (req, res) => {
  try {
    const { address_id } = req.params;
    const address = await UserAddress.findOne({ address_id, user_id: req.user.user_id });
    if (!address) {
      return res.status(404).json({ error: 'Địa chỉ không tồn tại.' });
    }
    if (address.is_default) {
      return res.status(400).json({ error: 'Không thể xóa địa chỉ mặc định.' });
    }
    await UserAddress.deleteOne({ address_id });
    res.json({ message: 'Xóa địa chỉ thành công.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Đặt địa chỉ làm mặc định
router.put('/:address_id/set-default', async (req, res) => {
  try {
    const { address_id } = req.params;
    const address = await UserAddress.findOne({ address_id, user_id: req.user.user_id });
    if (!address) {
      return res.status(404).json({ error: 'Địa chỉ không tồn tại.' });
    }
    // Đặt tất cả địa chỉ khác của user cùng loại type thành không mặc định
    await UserAddress.updateMany(
      { user_id: req.user.user_id, type: address.type, address_id: { $ne: address_id } },
      { $set: { is_default: false } }
    );
    // Đặt địa chỉ này làm mặc định
    address.is_default = true;
    await address.save();
    res.json({ message: 'Đặt địa chỉ làm mặc định thành công.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;