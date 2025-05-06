const express = require('express');
const router = express.Router();
const Coupon = require('../models/Coupon');

router.post('/', async (req, res) => {
  try {
    const { code, discount_type, discount_value, valid_from, valid_to, max_uses, min_order_amount } = req.body;
    if (!code || !discount_type || !discount_value || !valid_from || !valid_to || !max_uses || !min_order_amount) {
      return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ các trường bắt buộc.' });
    }
    const coupon = new Coupon({
      coupon_id: `coupon_${Date.now()}`,
      code,
      discount_type,
      discount_value,
      valid_from,
      valid_to,
      max_uses,
      uses_count: 0,
      min_order_amount,
      is_active: true
    });
    await coupon.save();
    res.json({ message: 'Tạo coupon thành công.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const coupons = await Coupon.find();
    res.json(coupons);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;