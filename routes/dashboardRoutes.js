const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const authenticateToken = require('../middleware/authenticateToken');

router.get('/admin-stats', authenticateToken(['admin']), dashboardController.getAdminDashboardStats);

module.exports = router;