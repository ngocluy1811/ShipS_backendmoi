const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const authenticateToken = require('../middleware/authenticateToken');

router.get('/shipping-costs', authenticateToken(['admin']), dashboardController.getShippingCosts);

module.exports = router; 