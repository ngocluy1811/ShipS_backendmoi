const express = require('express');
const router = express.Router();
const UserCoupon = require('../models/UserCoupon');
const Coupon = require('../models/Coupon');
const Notification = require('../models/Notification');
const { sendNotificationToUser } = require('../socket');

router.post('/', async (req, res) => {
  try {
    const { user_id, coupon_id } = req.body;
    if (!user_id || !coupon_id) {
      return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ user_id và coupon_id.' });
    }
    const coupon = await Coupon.findOne({ coupon_id });
    if (!coupon) {
      return res.status(404).json({ error: 'Coupon không tồn tại.' });
    }
    if (!coupon.is_active || coupon.uses_count >= coupon.max_uses) {
      return res.status(400).json({ error: 'Coupon không khả dụng.' });
    }
    const userCoupon = new UserCoupon({
      usercoupon_id: `usercoupon_${Date.now()}`,
      user_id,
      coupon_id,
      status: 'unused'
    });
    await userCoupon.save();

    // Tạo notification đúng schema
    const now = new Date();
    const notif = await Notification.create({
      notification_id: `notification_${Date.now()}`,
      user_id,
      title: 'Bạn vừa nhận được mã giảm giá mới!',
      content: `Mã giảm giá: ${coupon.code} - ${coupon.discount_type === 'percent' ? coupon.discount_value + '%' : coupon.discount_value + 'đ'}`,
      sent_at: now,
      status: 'unread',
      read_at: null
    });
    // Gửi realtime qua socket
    if (sendNotificationToUser) {
      sendNotificationToUser(user_id, {
        notification_id: notif.notification_id,
        type: 'coupon',
        title: notif.title,
        content: notif.content,
        sent_at: notif.sent_at,
        status: notif.status
      });
    }

    res.json({ message: 'Gán coupon thành công.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const user_id = req.query.user_id;
    if (req.user.role === 'customer' && req.user.user_id !== user_id) {
      return res.status(403).json({ error: 'Không có quyền xem coupon của user khác.' });
    }
    const userCoupons = await UserCoupon.find({ user_id });
    const result = await Promise.all(
      userCoupons.map(async (userCoupon) => {
        const coupon = await Coupon.findOne({ coupon_id: userCoupon.coupon_id });
        return {
          ...userCoupon._doc,
          coupon: coupon
        };
      })
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:usercoupon_id', async (req, res) => {
  try {
    const { usercoupon_id } = req.params;
    const userCoupon = await UserCoupon.findOne({ usercoupon_id, user_id: req.user.user_id });
    if (!userCoupon) {
      return res.status(404).json({ error: 'Coupon không tồn tại.' });
    }
    if (userCoupon.status !== 'unused') {
      return res.status(400).json({ error: 'Chỉ có thể xóa coupon chưa sử dụng.' });
    }
    await UserCoupon.deleteOne({ usercoupon_id });
    res.json({ message: 'Xóa coupon thành công.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;