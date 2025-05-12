const express = require('express');
const router = express.Router();

// Route mẫu cho tìm kiếm đơn hàng
router.get('/', (req, res) => {
  res.status(501).json({ message: 'Chức năng tìm kiếm đơn hàng chưa phát triển.' });
});

module.exports = router; 