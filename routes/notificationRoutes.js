const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const authenticateToken = require('../middleware/authenticateToken');
const { sendNotificationToUser } = require('../socket');

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
    sendNotificationToUser(user_id, notification);
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

// Đánh dấu 1 thông báo là đã đọc
router.patch('/:id/mark-read', authenticateToken(['customer', 'admin', 'staff', 'shipper']), async (req, res) => {
  console.log('PATCH mark-read', { 
    user: req.user, 
    id: req.params.id,
    body: req.body
  });
  try {
    const notification = await Notification.findOne({ 
      notification_id: req.params.id, 
      user_id: req.user.user_id 
    });
    
    console.log('Found notification:', notification);
    
    if (!notification) {
      console.log('Không tìm thấy notification để update', {
        notification_id: req.params.id, 
        user_id: req.user.user_id,
        query: { notification_id: req.params.id, user_id: req.user.user_id }
      });
      return res.status(404).json({ error: 'Không tìm thấy thông báo.' });
    }

    notification.status = 'read';
    notification.read_at = new Date();
    await notification.save();
    
    console.log('Updated notification:', notification);
    
    res.json({ message: 'Đã đánh dấu đã đọc.' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Không thể cập nhật trạng thái thông báo.' });
  }
});

// Đánh dấu tất cả là đã đọc
router.patch('/mark-all-read', authenticateToken(['customer', 'admin', 'staff', 'shipper']), async (req, res) => {
  console.log('PATCH mark-all-read', req.user);
  try {
    const notifications = await Notification.find({ user_id: req.user.user_id, status: { $ne: 'read' } });
    console.log('Notifications to update:', notifications.length);
    for (const notification of notifications) {
      notification.status = 'read';
      notification.read_at = new Date();
      await notification.save();
    }
    res.json({ message: 'Đã đánh dấu tất cả đã đọc.' });
  } catch (error) {
    res.status(500).json({ error: 'Không thể cập nhật trạng thái thông báo.' });
  }
});

module.exports = router;