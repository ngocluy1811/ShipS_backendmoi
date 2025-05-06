const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

router.get('/', paymentController.getPayments);
router.post('/', paymentController.createPayment);
router.post('/momo/callback', paymentController.momoCallback);
router.post('/zalopay/callback', paymentController.zaloPayCallback);

module.exports = router;