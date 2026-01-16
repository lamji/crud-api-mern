const Notification = require('../models/Notification');
const { logError, formatDate } = require('../utils/logging');

/**
 * Save notification to database
 * @param {string} userId - User ID
 * @param {string} type - Notification type ('order', 'payment', etc.)
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} status - Status ('success', 'info', 'warning', 'error')
 * @param {object} options - Additional options
 * @param {string} options.orderId - Order ID
 * @param {number} options.amount - Amount
 * @param {Array} options.items - Order items
 */
async function saveNotification(userId, type, title, message, status = 'info', options = {}) {
  try {
    console.log(`[${formatDate()}] - 💾 SAVING NOTIFICATION TO DATABASE | User: ${userId} | Type: ${type}`);
    
    const notificationData = {
      userId,
      type,
      title,
      message,
      status,
      read: false
    };

    // Add optional fields if provided
    if (options.orderId) notificationData.orderId = options.orderId;
    if (options.amount) notificationData.amount = options.amount;
    if (options.items && options.items.length > 0) {
      notificationData.items = options.items.map(item => ({
        productId: item.productId || item.product,
        productName: item.productName || 'Product',
        productImage: item.productImage || '',
        productPrice: item.price || item.productPrice || 0,
        productCategory: item.productCategory || '',
        quantity: item.quantity || 1
      }));
    }

    const notification = new Notification(notificationData);
    await notification.save();

    console.log(`[${formatDate()}] - ✅ NOTIFICATION SAVED SUCCESSFULLY | ID: ${notification._id} | User: ${userId}`);
    return notification;

  } catch (error) {
    logError(`❌ FAILED TO SAVE NOTIFICATION | User: ${userId} | Error: ${error.message}`);
    throw error;
  }
}

/**
 * Save payment notification (success or failure)
 * @param {string} userId - User ID
 * @param {boolean} isSuccess - Whether payment was successful
 * @param {object} orderData - Order information
 * @param {string} orderData.orderId - Order ID
 * @param {number} orderData.totalAmount - Total amount
 * @param {Array} orderData.items - Order items
 * @param {object} paymentData - Payment information
 * @param {string} paymentData.paymentId - Payment ID
 * @param {string} paymentData.paymentMethod - Payment method
 * @param {number} paymentData.paymentFee - Payment fee
 */
async function savePaymentNotification(userId, isSuccess, orderData, paymentData = {}) {
  try {
    const type = 'payment';
    const status = isSuccess ? 'success' : 'error';
    const title = isSuccess ? 'Payment Confirmed' : 'Payment Failed';
    const message = isSuccess 
      ? `Your payment for order ${orderData.orderId} has been successfully processed.`
      : `Your payment for order ${orderData.orderId} failed. Please try again.`;

    console.log(`[${formatDate()}] - 💾 SAVING PAYMENT NOTIFICATION | Success: ${isSuccess} | Order: ${orderData.orderId}`);

    const notificationData = {
      userId,
      type,
      title,
      message,
      status,
      read: false,
      orderId: orderData.orderId,
      amount: orderData.totalAmount,
      // Payment specific fields
      paymentStatus: isSuccess ? 'paid' : 'failed',
      paymentAmount: orderData.totalAmount,
      // Order specific fields
      orderStatus: isSuccess ? 'processing' : 'pending'
    };

    // Add payment details if provided
    if (paymentData.paymentId) notificationData.paymentId = paymentData.paymentId;
    if (paymentData.paymentMethod) notificationData.paymentMethod = paymentData.paymentMethod;
    if (paymentData.paymentFee !== undefined) notificationData.paymentFee = paymentData.paymentFee;

    // Add items if provided
    if (orderData.items && orderData.items.length > 0) {
      notificationData.items = orderData.items.map(item => ({
        productId: item.productId || item.product,
        productName: item.productName || 'Product',
        productImage: item.productImage || '',
        productPrice: item.price || item.productPrice || 0,
        productCategory: item.productCategory || '',
        quantity: item.quantity || 1
      }));
    }

    const notification = new Notification(notificationData);
    await notification.save();

    console.log(`[${formatDate()}] - ✅ PAYMENT NOTIFICATION SAVED | Order: ${orderData.orderId} | Success: ${isSuccess} | Payment Status: ${notificationData.paymentStatus}`);
    return notification;

  } catch (error) {
    logError(`❌ FAILED TO SAVE PAYMENT NOTIFICATION | Order: ${orderData.orderId} | Error: ${error.message}`);
    throw error;
  }
}

/**
 * Save order status notification
 * @param {string} userId - User ID
 * @param {string} orderId - Order ID
 * @param {string} orderStatus - New order status
 * @param {Array} items - Order items
 */
async function saveOrderStatusNotification(userId, orderId, orderStatus, items = []) {
  try {
    const title = 'Order Update';
    const message = `Order ${orderId} is now ${orderStatus}`;
    const status = orderStatus === 'delivered' ? 'success' : 'info';

    console.log(`[${formatDate()}] - 💾 SAVING ORDER STATUS NOTIFICATION | Order: ${orderId} | Status: ${orderStatus}`);

    const notification = await saveNotification(userId, 'order', title, message, status, {
      orderId,
      items
    });

    console.log(`[${formatDate()}] - ✅ ORDER STATUS NOTIFICATION SAVED | Order: ${orderId} | Status: ${orderStatus}`);
    return notification;

  } catch (error) {
    logError(`❌ FAILED TO SAVE ORDER STATUS NOTIFICATION | Order: ${orderId} | Error: ${error.message}`);
    throw error;
  }
}

module.exports = {
  saveNotification,
  savePaymentNotification,
  saveOrderStatusNotification
};
