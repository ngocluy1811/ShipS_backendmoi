const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const axios = require('axios');
const crypto = require('crypto');
const paymentConfig = require('../config/paymentConfig');

// Lấy danh sách thanh toán
router.get('/', async (req, res) => {
  try {
    let query = {};
    
    // Nếu là customer, chỉ xem được thanh toán của mình
    if (req.user.role === 'customer') {
      query.customer_id = req.user.user_id;
    }
    // Admin và staff xem được tất cả
    else if (req.user.role !== 'admin' && req.user.role !== 'staff') {
      return res.status(403).json({ error: 'Không có quyền truy cập.' });
    }

    const payments = await Payment.find(query).sort({ created_at: -1 });
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Tạo thanh toán mới
router.post('/', async (req, res) => {
  try {
    const { order_id, amount, payment_type, method } = req.body;

    if (req.user.role !== 'customer') {
      return res.status(403).json({ error: 'Chỉ customer được tạo thanh toán.' });
    }

    if (!order_id || !amount || !payment_type || !method) {
      return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ order_id, amount, payment_type và method.' });
    }

    const order = await Order.findOne({ order_id, customer_id: req.user.user_id });
    if (!order) {
      return res.status(404).json({ error: 'Đơn hàng không tồn tại hoặc không thuộc customer này.' });
    }

    if (payment_type === 'prepaid' && order.status !== 'pending') {
      return res.status(400).json({ error: 'Thanh toán trước chỉ áp dụng cho đơn hàng ở trạng thái pending.' });
    }
    if (payment_type === 'postpaid' && order.status !== 'delivered') {
      return res.status(400).json({ error: 'Thanh toán sau chỉ áp dụng cho đơn hàng đã giao (delivered).' });
    }

    const payment = new Payment({
      payment_id: `payment_${Date.now()}`,
      order_id,
      customer_id: req.user.user_id,
      amount,
      payment_type,
      method,
      status: 'pending',
      created_at: new Date()
    });

    let paymentUrl;
    if (method === 'cash') {
      payment.status = 'completed';
      payment.paid_at = new Date();
      await payment.save();
      // Đơn COD: payment_status vẫn là 'pending'
      return res.json({ message: 'Tạo thanh toán thành công.' });
    }

    if (method === 'momo') {
      paymentUrl = await createMoMoPayment(payment);
      payment.status = 'completed';
      payment.paid_at = new Date();
      await payment.save();
      // Cập nhật trạng thái thanh toán của đơn hàng
      await Order.updateOne(
        { order_id: payment.order_id },
        { $set: { payment_status: 'paid' } }
      );
    } else if (method === 'zalopay') {
      paymentUrl = await createZaloPayPayment(payment);
      payment.status = 'completed';
      payment.paid_at = new Date();
      await payment.save();
      // Cập nhật trạng thái thanh toán của đơn hàng
      await Order.updateOne(
        { order_id: payment.order_id },
        { $set: { payment_status: 'paid' } }
      );
    }

    if (!paymentUrl) {
      return res.status(500).json({ error: 'Không thể tạo giao dịch thanh toán: paymentUrl không được tạo.' });
    }

    return res.json({ message: 'Tạo giao dịch thanh toán thành công.', paymentUrl });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Xử lý callback từ MoMo
router.post('/momo/callback', async (req, res) => {
  try {
    const { orderId, resultCode } = req.body;
    const payment = await Payment.findOne({ payment_id: orderId });
    if (!payment) {
      return res.status(404).json({ error: 'Giao dịch không tồn tại.' });
    }
    payment.status = resultCode === '0' ? 'completed' : 'failed';
    if (resultCode === '0') {
      payment.paid_at = new Date();
      // Cập nhật trạng thái thanh toán của đơn hàng
      await Order.updateOne(
        { order_id: payment.order_id },
        { $set: { payment_status: 'paid' } }
      );
    }
    await payment.save();
    res.json({ message: 'Cập nhật trạng thái thanh toán thành công.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Xử lý callback từ ZaloPay
router.post('/zalopay/callback', async (req, res) => {
  try {
    const { data, mac } = req.body;
    const { key2 } = paymentConfig.zalopay;
    const verifyMac = crypto.createHmac('sha256', key2).update(data).digest('hex');
    if (verifyMac !== mac) {
      return res.status(400).json({ error: 'Chữ ký không hợp lệ.' });
    }
    const { app_trans_id, status } = JSON.parse(data);
    const payment = await Payment.findOne({ transaction_id: app_trans_id });
    if (!payment) {
      return res.status(404).json({ error: 'Giao dịch không tồn tại.' });
    }
    payment.status = status === 1 ? 'completed' : 'failed';
    if (status === 1) {
      payment.paid_at = new Date();
      // Cập nhật trạng thái thanh toán của đơn hàng
      await Order.updateOne(
        { order_id: payment.order_id },
        { $set: { payment_status: 'paid' } }
      );
    }
    await payment.save();
    res.json({ return_code: 1, return_message: 'Cập nhật trạng thái thanh toán thành công.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper functions
const createMoMoPayment = async (payment) => {
  try {
    const { partnerCode, accessKey, secretKey, endpoint, returnUrl, notifyUrl, paymentCode } = paymentConfig.momo;
    const requestId = payment.payment_id;
    const orderId = payment.payment_id;
    const amount = payment.amount.toString();
    const orderInfo = `Thanh toán đơn hàng ${payment.order_id}`;
    const requestType = 'payWithMethod';
    const extraData = '';
    const autoCapture = true;
    const lang = 'vi';
    const orderGroupId = '';

    const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${notifyUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${returnUrl}&requestId=${requestId}&requestType=${requestType}`;
    const signature = crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');

    const requestBody = JSON.stringify({
      partnerCode: partnerCode,
      partnerName: "Test",
      storeId: "MomoTestStore",
      requestId: requestId,
      amount: amount,
      orderId: orderId,
      orderInfo: orderInfo,
      redirectUrl: returnUrl,
      ipnUrl: notifyUrl,
      lang: lang,
      requestType: requestType,
      autoCapture: autoCapture,
      extraData: extraData,
      orderGroupId: orderGroupId,
      signature: signature,
      paymentCode: paymentCode
    });

    const response = await axios.post(endpoint, JSON.parse(requestBody), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    });

    if (!response.data || !response.data.payUrl) {
      throw new Error('Không thể tạo giao dịch MoMo: payUrl không tồn tại trong response.');
    }

    payment.transaction_id = response.data.orderId;
    return response.data.payUrl;
  } catch (error) {
    throw new Error(`Lỗi khi tạo giao dịch MoMo: ${error.message}`);
  }
};

const createZaloPayPayment = async (payment) => {
  try {
    const { appId, key1, endpoint, callbackUrl } = paymentConfig.zalopay;
    const appTransId = `${Date.now()}_${payment.payment_id}`;
    const appTime = Date.now();
    const amount = payment.amount;
    const appUser = payment.customer_id;
    const item = JSON.stringify([]);
    const description = `Thanh toán đơn hàng ${payment.order_id}`;
    const embedData = JSON.stringify({});

    const rawSignature = `${appId}|${appTransId}|${appUser}|${amount}|${appTime}|${embedData}|${item}`;
    const mac = crypto.createHmac('sha256', key1).update(rawSignature).digest('hex');

    const requestBody = {
      app_id: appId,
      app_user: appUser,
      app_time: appTime,
      amount,
      app_trans_id: appTransId,
      embed_data: embedData,
      item,
      description,
      mac,
      callback_url: callbackUrl
    };

    const response = await axios.post(endpoint, requestBody, {
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.data || response.data.return_code !== 1 || !response.data.order_url) {
      throw new Error(`Không thể tạo giao dịch ZaloPay: ${response.data?.return_message || 'order_url không tồn tại.'}`);
    }

    payment.transaction_id = appTransId;
    return response.data.order_url;
  } catch (error) {
    throw new Error(`Lỗi khi tạo giao dịch ZaloPay: ${error.message}`);
  }
};

module.exports = router;