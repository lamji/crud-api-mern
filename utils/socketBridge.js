/**
 * HTTP → SOCKET BRIDGE
 * Handles HTTP requests that emit socket.io events
 */

const { formatDate } = require('./logging');

/**
 * Creates a socket bridge middleware
 * @param {Object} io - Socket.io instance
 * @returns {Function} Express middleware function
 */
function createSocketBridge(io) {
  return (req, res) => {
    const { event, payload } = req.body;
    console.log(`\n[${formatDate()}] - 📡 SOCKET.IO BRIDGE REQUEST RECEIVED | Event: ${event} | Payload:`, JSON.stringify(payload, null, 2));
    
    // 1. Global Broadcast
    io.emit(event, payload);
    console.log(`[${formatDate()}] - 📢 GLOBAL BROADCAST SENT | Event: ${event}`);

    // 2. Room-specific Broadcast
    const targetUserId = payload.userId || (payload.data && payload.data.userId);
    if (targetUserId) {
      io.to(`user:${targetUserId}`).emit(event, payload);
      console.log(`[${formatDate()}] - 🎯 ROOM BROADCAST SENT | Target: user:${targetUserId} | Event: ${event}`);
    }
    
    res.json({ success: true });
  };
}

module.exports = { createSocketBridge };
