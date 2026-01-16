const https = require('https');
const { logError, formatDate } = require('../utils/logging');

const ONE_SIGNAL_APP_ID = process.env.ONE_SIGNAL_APP_ID;
const ONE_SIGNAL_API_KEY = process.env.ONE_SIGNAL_API_KEY;

// Test mode - use hardcoded ID instead of createdAtKey
const TEST_MODE = true;
const TEST_EXTERNAL_USER_ID = '260115150658733';

/**
 * Emit notification via Socket.IO server (direct instance)
 * @param {string} userId - The user ID to target
 * @param {string} event - The event name
 * @param {object} payload - The notification payload
 */
async function emitSocketNotification(userId, event, payload) {
  try {
    console.log(`\n[${formatDate()}] - 🌐 SOCKET.IO NOTIFICATION PROCESS STARTED | Event: ${event} | User: ${userId}`);
    console.log(`[${formatDate()}] - � Notification payload:`, JSON.stringify(payload, null, 2));

    // Get the global Socket.IO instance from server.js
    const io = global.io;
    
    if (!io) {
      logError(`❌ SOCKET.IO INSTANCE NOT FOUND - Make sure server.js has global.io = io`);
      return;
    }

    console.log(`[${formatDate()}] - ✅ Socket.IO instance found and ready`);

    // Prepare notification payload
    const notificationPayload = {
      userId: userId,
      data: payload,
      timestamp: new Date().toISOString()
    };

    // 1. Global Broadcast (to all connected sockets)
    io.emit(event, notificationPayload);
    console.log(`[${formatDate()}] - 📢 GLOBAL BROADCAST SENT | Event: ${event}`);

    // 2. Room-specific Broadcast (to joined users)
    if (userId) {
      io.to(`user:${userId}`).emit(event, notificationPayload);
      console.log(`[${formatDate()}] - 🎯 ROOM BROADCAST SENT | Target: user:${userId} | Event: ${event}`);
    }

    console.log(`[${formatDate()}] - ✅ SOCKET.IO NOTIFICATION SENT SUCCESSFULLY | User: ${userId}`);

  } catch (error) {
    logError(`❌ SOCKET.IO NOTIFICATION FAILED | Error: ${error.message}`);
    logError(`📍 Make sure Socket.IO is properly initialized in server.js`);
  }
}

/**
 * Sends a push notification using the OneSignal API.
 * @param {string} externalUserId - The external user ID (createdAtKey) to target.
 * @param {string} title - The notification title.
 * @param {string} message - The notification message content.
 * @param {object} [data={}] - Additional data to send with the notification.
 */
async function sendPushNotification(externalUserId, title, message, data = {}) {
  if (!ONE_SIGNAL_APP_ID || !ONE_SIGNAL_API_KEY) {
    console.log(`[${formatDate()}] - ⚠️  OneSignal not configured. Skipping push notification.`);
    return;
  }

  // Use test ID if test mode is enabled
  const targetUserId = TEST_MODE ? TEST_EXTERNAL_USER_ID : externalUserId;
  
  if (!targetUserId) {
    console.log(`[${formatDate()}] - ⚠️  No target user ID provided. Cannot send push notification.`);
    return;
  }

  if (TEST_MODE) {
    console.log(`[${formatDate()}] - 🧪 TEST MODE: Using hardcoded ID ${targetUserId} instead of ${externalUserId}`);
  }

  // Prepare notification payload for both OneSignal and Socket.IO
  const notificationPayload = {
    title: title,
    message: message,
    data: data,
    type: 'payment_confirmation'
  };

  // Send via Socket.IO for real-time delivery
  await emitSocketNotification(externalUserId, 'order:update', notificationPayload);

  const notification = {
    app_id: ONE_SIGNAL_APP_ID,
    include_external_user_ids: [targetUserId],
    channel_for_external_user_ids: 'push',
    headings: { en: title },
    contents: { en: message },
    data: data,
  };

  const options = {
    hostname: 'onesignal.com',
    port: 443,
    path: '/api/v1/notifications',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Authorization': `Basic ${ONE_SIGNAL_API_KEY}`,
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode <= 299) {
          console.log(`[${formatDate()}] - ✅ OneSignal notification sent successfully to ${externalUserId}.`);
          resolve(JSON.parse(responseBody));
        } else {
          logError(`❌ OneSignal API error: ${res.statusCode} - ${responseBody}`);
          reject(new Error(`OneSignal API error: ${res.statusCode}`));
        }
      });
    });

    req.on('error', (error) => {
      logError(`❌ Failed to send OneSignal notification: ${error.message}`);
      reject(error);
    });

    req.write(JSON.stringify(notification));
    req.end();
  });
}

module.exports = { sendPushNotification };
