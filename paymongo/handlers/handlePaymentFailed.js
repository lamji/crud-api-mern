const { updateOrderStatus } = require('./updateOrderStatus');
const { createPaymentNotification } = require('./createPaymentNotification');
const { logError, formatDate } = require('../../utils/logging');

async function handlePaymentFailed(event) {
  try {
    const payment = event.data;
    console.log(`[${formatDate()}] - ❌ PAYMENT FAILED | ID: ${payment.id}`);

    // Update order status
    if (payment.attributes.metadata?.order_id) {
      await updateOrderStatus(
        payment.attributes.metadata.order_id,
        'payment_failed',
        payment.id
      );
    }

    // Create notification
    if (payment.attributes.metadata?.user_id) {
      await createPaymentNotification(
        payment.attributes.metadata.user_id,
        'Payment Failed',
        `Your payment of ₱${(payment.attributes.amount / 100).toFixed(2)} has failed. Please try again.`,
        'error'
      );
    }
  } catch (error) {
    logError(`❌ Error handling payment failed: ${error.message}`);
  }
}

module.exports = { handlePaymentFailed };
