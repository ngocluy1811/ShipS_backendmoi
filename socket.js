const { Server } = require('socket.io');
const Tracking = require('./models/Tracking');

let io;
const userSockets = {};

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: ['http://localhost:5173', 'http://localhost:5174', 'https://ships-admin.onrender.com', 'https://ships-customermoi.onrender.com', 'https://ships-backendmoi-k6ob.onrender.com'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log('[SOCKET] New client connected:', socket.id);

    socket.on('register', (user_id) => {
      userSockets[user_id] = socket.id;
      console.log('[SOCKET] User registered:', user_id, '->', socket.id);
    });

    socket.on('join_order_room', (order_id) => {
      socket.join(order_id);
      console.log('[SOCKET] Socket', socket.id, 'joined room', order_id);
    });

    socket.on('join_orders_room', () => {
      socket.join('orders');
      console.log('[SOCKET] Admin joined orders room');
    });

    socket.on('join_warehouse_room', (warehouse_id) => {
      socket.join(`warehouse_${warehouse_id}`);
      console.log('[SOCKET] Admin joined warehouse room:', warehouse_id);
    });

    socket.on('unregister', (user_id) => {
      if (userSockets[user_id] === socket.id) {
        delete userSockets[user_id];
        console.log('[SOCKET] User unregistered:', user_id);
      }
    });

    socket.on('disconnect', () => {
      console.log('[SOCKET] Client disconnected:', socket.id);
      for (const [user_id, id] of Object.entries(userSockets)) {
        if (id === socket.id) {
          delete userSockets[user_id];
          console.log('[SOCKET] User disconnected:', user_id);
          break;
        }
      }
    });

    // Start tracking via socket
    socket.on('shipper_start_tracking', async (data) => {
      try {
        const { order_id, shipper_id } = data;
        // Stop all other active tracking for this shipper
        await Tracking.updateMany(
          { shipper_id, order_id: { $ne: order_id }, status: 'active' },
          { status: 'stopped', stopped_at: new Date() }
        );
        // Create or update tracking
        let tracking = await Tracking.findOne({ order_id, shipper_id });
        if (tracking) {
          tracking.status = 'active';
          tracking.started_at = new Date();
          tracking.stopped_at = null;
          await tracking.save();
        } else {
          tracking = new Tracking({
            tracking_id: `tracking_${Date.now()}`,
            order_id,
            shipper_id,
            status: 'active',
            started_at: new Date()
          });
          await tracking.save();
        }
        io.to(order_id).emit('shipper_tracking_updated', {
          order_id,
          is_tracking_active: true
        });
      } catch (error) {
        console.error('Error in shipper_start_tracking:', error);
      }
    });

    // Stop tracking via socket
    socket.on('shipper_stop_tracking', async (data) => {
      try {
        const { order_id, shipper_id } = data;
        const tracking = await Tracking.findOne({
          order_id,
          shipper_id,
          status: 'active'
        });
        if (tracking) {
          tracking.status = 'stopped';
          tracking.stopped_at = new Date();
          await tracking.save();
          io.to(order_id).emit('shipper_tracking_updated', {
            order_id,
            is_tracking_active: false
          });
        }
      } catch (error) {
        console.error('Error in shipper_stop_tracking:', error);
      }
    });

    // Add new event for location updates
    socket.on('shipper_location_update', async (data) => {
      try {
        const { order_id, shipper_id, location } = data;
        const tracking = await Tracking.findOne({ 
          order_id,
          shipper_id,
          status: 'active'
        });
        
        if (tracking) {
          tracking.location = location;
          await tracking.save();
          
          // Emit to order room
          io.to(order_id).emit('shipper_location_updated', {
            order_id,
            location
          });
        }
      } catch (error) {
        console.error('Error in shipper_location_update:', error);
      }
    });

    // Chat realtime theo order_id
    socket.on('chat_message', (msg) => {
      // msg: { orderId, ... }
      if (msg.orderId) {
        io.to(msg.orderId).emit('chat_message', msg);
      }
    });

    // Video call signaling
    socket.on('video_call_request', ({ orderId, from }) => {
      // Gửi yêu cầu gọi tới room (trừ người gọi)
      socket.to(orderId).emit('video_call_request', { from });
    });
    socket.on('video_call_accept', ({ orderId }) => {
      socket.to(orderId).emit('video_call_accept');
    });
    socket.on('video_call_reject', ({ orderId }) => {
      socket.to(orderId).emit('video_call_reject');
    });
    socket.on('video_call_busy', ({ orderId }) => {
      socket.to(orderId).emit('video_call_busy');
    });
    socket.on('video_offer', ({ orderId, offer }) => {
      socket.to(orderId).emit('video_offer', { offer });
    });
    socket.on('video_answer', ({ orderId, answer }) => {
      socket.to(orderId).emit('video_answer', { answer });
    });
    socket.on('video_ice_candidate', ({ orderId, candidate }) => {
      socket.to(orderId).emit('video_ice_candidate', { candidate });
    });
    socket.on('video_call_end', ({ orderId }) => {
      socket.to(orderId).emit('video_call_end', {});
    });
  });
}

// Thêm hàm emit order_claimed
function emitOrderClaimed(orderId, shipperName, status, claimedAt) {
  if (!io) return;
  console.log('[SOCKET] Emitting order_claimed:', { orderId, shipperName, status, claimedAt });
  io.to('orders').emit('order_claimed', {
    orderId,
    shipperName,
    status,
    claimedAt
  });
}

function sendNotificationToUser(user_id, notification) {
  if (!io) return;
  const socketId = userSockets[user_id];
  if (socketId) {
    io.to(socketId).emit('new-notification', notification);
    console.log('[SOCKET] Sent notification to', user_id, notification);
  } else {
    console.log('[SOCKET] No socket found for user', user_id);
  }
}

function getIO() {
  return io;
}

module.exports = { initSocket, sendNotificationToUser, getIO, emitOrderClaimed }; 