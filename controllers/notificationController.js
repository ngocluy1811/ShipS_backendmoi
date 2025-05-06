const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');

router.post('/', async (req, res) => {
  try {
    const { user_id, title, content } = req.body;
    if (!user_id || !title || !content) {
      return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ user_id, title và content.' });
    }
    const notification = new Notification({
      notification_id: `notification_${Date.now()}`,
      user_id,
      title,
      content,
      sent_at: new Date(),
      status: 'unread'
    });
    await notification.save();
    res.json({ message: 'Tạo thông báo thành công.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const notifications = await Notification.find({ user_id: req.user.user_id });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;