const User = require('../../models/User');
const Profile = require('../../models/Profile');
const { sendPaymentConfirmation } = require('../../helpers/emailService');
const { sendPushNotification } = require('../../helpers/oneSignalNotification');
const { savePaymentNotification } = require('../../helpers/notificationHelper');
const { logError, formatDate } = require('../../utils/logging');

async function createPaymentNotification(userId, title, message, type) {
  try {
    console.log(`[${formatDate()}] - 📧 Creating payment notification for user ${userId}: ${title} - ${message}`);

    const user = await User.findById(userId);
    if (!user) {
      logError(`❌ User not found for notification: ${userId}`);
      return;
    }

    if (type === 'payment_confirmed') {
      const profile = await Profile.findOne({ userId: userId }).sort({ createdAt: -1 });

      if (profile && profile.orders && profile.orders.length > 0) {
        const latestOrder = profile.orders[profile.orders.length - 1];
        const orderData = {
          orderId: latestOrder.orderId,
          orderNumber: latestOrder.orderNumber,
          totalAmount: latestOrder.totalAmount,
          shippingFee: latestOrder.shippingFee,
          paymentFee: latestOrder.paymentFee,
          paymentMethod: latestOrder.paymentMethod,
          items: latestOrder.items,
        };

        // --- Send Email Notification ---
        sendPaymentConfirmation(user.email, user.name, orderData)
          .then(sent => {
            if (sent) {
              console.log(`[${formatDate()}] - ✅ Payment confirmation email sent to ${user.email}`);
            } else {
              console.log(`[${formatDate()}] - ⚠️  Failed to send payment confirmation email to ${user.email}`);
            }
          })
          .catch(err => logError(`Email sending error: ${err.message}`));

        // --- Save to Database ---
        const paymentData = {
          paymentId: latestOrder.paymentMethod?.transactionId,
          paymentMethod: latestOrder.paymentMethod?.type,
          paymentFee: latestOrder.paymentFee || 0
        };
        
        savePaymentNotification(userId, true, orderData, paymentData)
          .then(notification => {
            console.log(`[${formatDate()}] - ✅ Payment notification saved to database for user ${userId}`);
          })
          .catch(err => logError(`Database notification error: ${err.message}`));

        // --- Send Push Notification ---
        if (profile.createdAtKey) {
          const pushTitle = 'Payment Confirmed!';
          const pushMessage = `Your order ${orderData.orderNumber} is now being processed. Thank you for your purchase!`;
          sendPushNotification(profile.createdAtKey, pushTitle, pushMessage, { orderId: orderData.orderNumber })
            .catch(err => logError(`Push notification sending error: ${err.message}`));
        } else {
          console.log(`[${formatDate()}] - ⚠️  No createdAtKey for user ${userId}. Skipping push notification.`);
        }

      } else {
        console.log(`[${formatDate()}] - ⚠️  No order history found for user ${userId}, cannot send detailed confirmation`);
      }
    }

    console.log(`[${formatDate()}] - 📝 Notification process completed for user ${userId}`);
  } catch (error) {
    logError(`❌ Error creating payment notification: ${error.message}`);
  }
}

module.exports = { createPaymentNotification };
