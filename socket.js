const { Server } = require('socket.io');

let io;
const userSockets = {};

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: ['http://localhost:5173', 'http://localhost:5174'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    socket.on('register', (user_id) => {
      userSockets[user_id] = socket.id;
      console.log('[SOCKET] User registered:', user_id, '->', socket.id);
    });

    socket.on('unregister', (user_id) => {
      if (userSockets[user_id] === socket.id) {
        delete userSockets[user_id];
        console.log('[SOCKET] User unregistered:', user_id);
      }
    });

    socket.on('disconnect', () => {
      for (const [user_id, id] of Object.entries(userSockets)) {
        if (id === socket.id) {
          delete userSockets[user_id];
          console.log('[SOCKET] User disconnected:', user_id);
          break;
        }
      }
    });
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

module.exports = { initSocket, sendNotificationToUser }; 