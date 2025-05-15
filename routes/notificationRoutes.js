const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const User = require('../models/User');
const authenticateToken = require('../middleware/authenticateToken');
const { sendNotificationToUser } = require('../socket');
const NotificationTemplate = require('../models/NotificationTemplate');
const NotificationList = require('../models/NotificationList');
const NotificationAuditLog = require('../models/NotificationAuditLog');

router.post('/', authenticateToken(['admin']), async (req, res) => {
  try {
    const { user_id, title, content, schedule } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ title và content.' });
    }
    if (!user_id || user_id === 'all') {
      // Gửi cho tất cả user
      const allUsers = await User.find({}, 'user_id');
      const notifications = [];
      for (const user of allUsers) {
        const notification = new Notification({
          notification_id: `notification_${Date.now()}_${user.user_id}`,
          user_id: user.user_id,
          title,
          content,
          schedule: schedule || null,
          sent_at: new Date(),
          status: 'unread'
        });
        await notification.save();
        notifications.push(notification);
        sendNotificationToUser(user.user_id, notification);
      }
      return res.json({ message: 'Đã gửi thông báo cho tất cả người dùng.' });
    } else {
      // Gửi cho 1 user
      const notification = new Notification({
        notification_id: `notification_${Date.now()}`,
        user_id,
        title,
        content,
        schedule: schedule || null,
        sent_at: new Date(),
        status: 'unread'
      });
      await notification.save();
      sendNotificationToUser(user_id, notification);
      return res.json({ message: 'Tạo thông báo thành công.' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', authenticateToken(['admin', 'customer', 'staff', 'shipper']), async (req, res) => {
  try {
    const { search, type, audience, status, fromDate, toDate, page = 1, limit = 20 } = req.query;
    const query = {};
    if (req.user.role !== 'admin') {
      query.user_id = req.user.user_id;
    }
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ];
    }
    if (type) query.type = type;
    if (audience) query.audience = audience;
    if (status) query.status = status;
    if (fromDate || toDate) {
      query.created_at = {};
      if (fromDate) query.created_at.$gte = new Date(fromDate);
      if (toDate) query.created_at.$lte = new Date(toDate);
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Notification.countDocuments(query);
    const data = await Notification.find(query).sort({ created_at: -1 }).skip(skip).limit(parseInt(limit));
    res.json({ data, total });
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

// CRUD cho NotificationTemplate
router.post('/templates', authenticateToken(['admin']), async (req, res) => {
  try {
    const { title, content, type, audience } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Thiếu tiêu đề hoặc nội dung.' });
    const template = new NotificationTemplate({
      template_id: `template_${Date.now()}`,
      title,
      content,
      type: type || 'in-app',
      audience: audience || 'all'
    });
    await template.save();
    res.json({ message: 'Tạo template thành công.', template });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/templates', authenticateToken(['admin']), async (req, res) => {
  try {
    const { search, type, audience, fromDate, toDate, page = 1, limit = 20 } = req.query;
    const query = {};
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ];
    }
    if (type) query.type = type;
    if (audience) query.audience = audience;
    if (fromDate || toDate) {
      query.created_at = {};
      if (fromDate) query.created_at.$gte = new Date(fromDate);
      if (toDate) query.created_at.$lte = new Date(toDate);
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await NotificationTemplate.countDocuments(query);
    const data = await NotificationTemplate.find(query).sort({ created_at: -1 }).skip(skip).limit(parseInt(limit));
    res.json({ data, total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/templates/:id', authenticateToken(['admin']), async (req, res) => {
  try {
    const { title, content, type, audience } = req.body;
    const template = await NotificationTemplate.findOneAndUpdate(
      { template_id: req.params.id },
      { title, content, type, audience, updated_at: new Date() },
      { new: true }
    );
    if (!template) return res.status(404).json({ error: 'Không tìm thấy template.' });
    res.json({ message: 'Cập nhật template thành công.', template });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/templates/:id', authenticateToken(['admin']), async (req, res) => {
  try {
    const template = await NotificationTemplate.findOneAndDelete({ template_id: req.params.id });
    if (!template) return res.status(404).json({ error: 'Không tìm thấy template.' });
    res.json({ message: 'Xóa template thành công.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Gửi thông báo từ template
router.post('/templates/:id/send', authenticateToken(['admin']), async (req, res) => {
  try {
    const { user_id, audience } = req.body;
    const template = await NotificationTemplate.findOne({ template_id: req.params.id });
    if (!template) return res.status(404).json({ error: 'Không tìm thấy template.' });
    const notificationData = {
      title: template.title,
      content: template.content,
      type: template.type,
      audience: template.audience,
      schedule: template.schedule || null,
      created_at: template.created_at || new Date(),
      sent_at: new Date(),
      status: 'unread'
    };
    if (user_id && user_id !== 'all') {
      // Gửi cho 1 user cụ thể
      const user = await User.findOne({ user_id });
      if (!user) return res.status(404).json({ error: 'Không tìm thấy user.' });
      const notification = new Notification({
        notification_id: `notification_${Date.now()}`,
        user_id,
        ...notificationData
      });
      await notification.save();
      sendNotificationToUser(user_id, notification);
      return res.json({ message: 'Đã gửi thông báo cho user.' });
    } else if (audience && audience !== 'all') {
      // Gửi cho đúng đối tượng (role)
      const users = await User.find({ role: audience, active: true });
      for (const user of users) {
        const notification = new Notification({
          notification_id: `notification_${Date.now()}_${user.user_id}`,
          user_id: user.user_id,
          ...notificationData
        });
        await notification.save();
        sendNotificationToUser(user.user_id, notification);
      }
      return res.json({ message: `Đã gửi thông báo cho tất cả ${audience}.`, count: users.length });
    } else {
      // Gửi cho tất cả user
      const allUsers = await User.find({ active: true }, 'user_id');
      for (const user of allUsers) {
        const notification = new Notification({
          notification_id: `notification_${Date.now()}_${user.user_id}`,
          user_id: user.user_id,
          ...notificationData
        });
        await notification.save();
        sendNotificationToUser(user.user_id, notification);
      }
      return res.json({ message: 'Đã gửi thông báo cho tất cả người dùng.' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Xóa 1 thông báo theo notification_id hoặc _id
router.delete('/notifications/:id', authenticateToken(['admin']), async (req, res) => {
  try {
    console.log('Xóa notification với id:', req.params.id);
    let deleted = await Notification.findOneAndDelete({ notification_id: req.params.id });
    console.log('Kết quả xóa theo notification_id:', deleted);
    if (!deleted) {
      console.log('Không tìm thấy theo notification_id, thử _id:', req.params.id);
      deleted = await Notification.findByIdAndDelete(req.params.id);
      console.log('Kết quả xóa theo _id:', deleted);
    }
    if (!deleted) {
      console.log('Không tìm thấy notification để xóa:', req.params.id);
      return res.status(404).json({ error: 'Không tìm thấy thông báo.' });
    }
    res.json({ message: 'Đã xóa thông báo.' });
  } catch (err) {
    console.error('Lỗi khi xóa notification:', err);
    res.status(500).json({ error: err.message });
  }
});

// Lấy lịch sử gửi của 1 notification
router.get('/:id/history', authenticateToken(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    // Tìm notification theo id (có thể là notification_id hoặc _id)
    let notification = await Notification.findOne({ notification_id: id });
    if (!notification) {
      notification = await Notification.findById(id);
    }
    if (!notification) {
      return res.status(404).json({ error: 'Không tìm thấy notification.' });
    }
    let history = [];
    if (notification.user_id === 'all') {
      // Nếu là gửi cho tất cả, tìm tất cả notification có cùng prefix
      const prefix = notification.notification_id.replace(/(_user_.*)$/, '');
      const all = await Notification.find({ notification_id: { $regex: `^${prefix}` } });
      history = all.map(n => ({
        recipient: n.user_id,
        status: n.status === 'read' ? 'Đã đọc' : 'Đã gửi',
        timestamp: n.sent_at ? n.sent_at.toLocaleString() : '',
        channel: n.type || 'in-app'
      }));
    } else {
      // Nếu là gửi cho 1 user
      history = [{
        recipient: notification.user_id,
        status: notification.status === 'read' ? 'Đã đọc' : 'Đã gửi',
        timestamp: notification.sent_at ? notification.sent_at.toLocaleString() : '',
        channel: notification.type || 'in-app'
      }];
    }
    res.json({ data: history });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Gửi lại thông báo thất bại
router.post('/:id/resend', authenticateToken(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    let notification = await Notification.findOne({ notification_id: id });
    if (!notification) {
      notification = await Notification.findById(id);
    }
    if (!notification) {
      return res.status(404).json({ error: 'Không tìm thấy notification.' });
    }
    if (notification.status !== 'failed') {
      return res.status(400).json({ error: 'Chỉ có thể gửi lại thông báo thất bại.' });
    }
    // Tạo notification mới với cùng nội dung
    const newNotification = new Notification({
      notification_id: `notification_${Date.now()}`,
      user_id: notification.user_id,
      title: notification.title,
      content: notification.content,
      type: notification.type,
      audience: notification.audience,
      schedule: notification.schedule || null,
      sent_at: new Date(),
      status: 'unread'
    });
    await newNotification.save();
    sendNotificationToUser(notification.user_id, newNotification);
    res.json({ message: 'Đã gửi lại thông báo thất bại thành công.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Tạo mẫu mới
router.post('/notificationlist', async (req, res) => {
  try {
    const data = req.body;
    const created = await NotificationList.create(data);
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Lấy danh sách mẫu
router.get('/notificationlist', async (req, res) => {
  try {
    const list = await NotificationList.find().sort({ created_at: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lấy chi tiết mẫu
router.get('/notificationlist/:id', async (req, res) => {
  try {
    const item = await NotificationList.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cập nhật mẫu
router.put('/notificationlist/:id', async (req, res) => {
  console.log('PUT /notificationlist/:id', req.params.id, req.body);
  try {
    const updated = await NotificationList.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) {
      console.log('Không tìm thấy bản ghi với id:', req.params.id);
      return res.status(404).json({ error: 'Not found' });
    }
    console.log('Cập nhật thành công:', updated);
    res.json(updated);
  } catch (err) {
    console.log('Lỗi khi update notificationlist:', err);
    res.status(400).json({ error: err.message });
  }
});

// Xóa mẫu
router.delete('/notificationlist/:id', async (req, res) => {
  try {
    const deleted = await NotificationList.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API lấy tùy chọn người dùng
router.get('/notification-preferences', async (req, res) => {
  try {
    const prefs = await NotificationPreferences.find();
    // Chuyển về dạng { group: { email, sms, inApp, push } }
    const result = {};
    prefs.forEach(p => {
      result[p.group] = {
        email: p.email,
        sms: p.sms,
        inApp: p.inApp,
        push: p.push
      };
    });
    res.json({ data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API lưu tùy chọn người dùng
router.put('/notification-preferences', async (req, res) => {
  try {
    const prefs = req.body;
    // prefs: { group: { email, sms, inApp, push } }
    for (const group in prefs) {
      await NotificationPreferences.findOneAndUpdate(
        { group },
        {
          group,
          email: !!prefs[group].email,
          sms: !!prefs[group].sms,
          inApp: !!prefs[group].inApp,
          push: !!prefs[group].push
        },
        { upsert: true }
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API lấy nhật ký hoạt động liên quan đến thông báo
router.get('/audit-log', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const total = await NotificationAuditLog.countDocuments();
    const logs = await NotificationAuditLog.find()
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);
    res.json({ data: logs, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;