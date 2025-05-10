const express = require('express');
const router = express.Router();
const Tracking = require('../models/Tracking');
const Order = require('../models/Order');

// Get tracking status for an order
router.get('/:orderId', async (req, res, next) => {
  try {
    const { orderId } = req.params;
    console.log('[DEBUG] orderId param:', orderId);

    const tracking = await Tracking.findOne({ 
      order_id: orderId,
      status: 'active'
    }).sort({ updated_at: -1 });

    console.log('[DEBUG] tracking found:', tracking);

    if (!tracking) {
      return res.status(404).json({ status: 'inactive' });
    }

    res.json(tracking);
  } catch (error) {
    console.error('Error getting tracking status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start tracking for an order
router.post('/:orderId/start', async (req, res) => {
  try {
    const { orderId } = req.params;
    const shipperId = req.user.id;

    // Check if order exists and is assigned to this shipper
    const order = await Order.findOne({
      order_id: orderId,
      shipper_id: shipperId,
      status: 'delivering'
    });

    if (!order) {
      return res.status(404).json({
        message: 'Không tìm thấy đơn hàng hoặc đơn hàng không trong trạng thái giao'
      });
    }

    // Stop all other active tracking for this shipper
    await Tracking.updateMany(
      { shipper_id: shipperId, order_id: { $ne: orderId }, status: 'active' },
      { status: 'stopped', stopped_at: new Date() }
    );

    // Create or update tracking
    let tracking = await Tracking.findOne({ order_id: orderId, shipper_id: shipperId });
    if (tracking) {
      tracking.status = 'active';
      tracking.started_at = new Date();
      tracking.stopped_at = null;
      await tracking.save();
    } else {
      tracking = new Tracking({
        tracking_id: `tracking_${Date.now()}`,
        order_id: orderId,
        shipper_id: shipperId,
        status: 'active',
        started_at: new Date()
      });
      await tracking.save();
    }

    res.json({ message: 'Đã bắt đầu theo dõi vị trí' });
  } catch (error) {
    console.error('Error starting tracking:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Stop tracking for an order
router.post('/:orderId/stop', async (req, res) => {
  try {
    const { orderId } = req.params;
    const shipperId = req.user.id;

    const tracking = await Tracking.findOne({
      order_id: orderId,
      shipper_id: shipperId,
      status: 'active'
    });

    if (!tracking) {
      return res.status(404).json({
        message: 'Không tìm thấy thông tin theo dõi'
      });
    }

    tracking.status = 'stopped';
    tracking.stopped_at = new Date();
    await tracking.save();

    res.json({ message: 'Đã dừng theo dõi vị trí' });
  } catch (error) {
    console.error('Error stopping tracking:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Update shipper location
router.put('/:orderId/location', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { location } = req.body;
    const shipperId = req.user.id;

    const tracking = await Tracking.findOne({ 
      order_id: orderId,
      shipper_id: shipperId,
      status: 'active'
    });

    if (!tracking) {
      return res.status(404).json({ error: 'Không tìm thấy tracking đang active.' });
    }

    tracking.location = location;
    await tracking.save();

    // Emit socket event
    req.app.get('io').to(orderId).emit('shipper_location_updated', {
      order_id: orderId,
      location
    });

    res.json({ message: 'Cập nhật vị trí thành công.' });
  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;