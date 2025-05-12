const express = require('express');
const router = express.Router();

// Route mẫu cho upload
router.post('/', (req, res) => {
  res.status(501).json({ message: 'Chức năng upload chưa phát triển.' });
});

module.exports = router; 