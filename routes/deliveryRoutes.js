const express = require('express');
const router = express.Router();
const deliveryController = require('../controllers/deliveryController');
const authenticateToken = require('../middleware/authenticateToken');

router.post('/calculate-cost', authenticateToken(['admin', 'shipper']), deliveryController.calculateDeliveryCost);

module.exports = router;