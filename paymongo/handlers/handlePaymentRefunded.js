const { updateOrderStatus } = require('./updateOrderStatus');
const { createPaymentNotification } = require('./createPaymentNotification');
const { logError, formatDate } = require('../../utils/logging');

async function handlePaymentRefunded(event) {
  try {
    const refund = event.data;
    console.log(`[${formatDate()}] - 💰 PAYMENT REFUNDED | ID: ${refund.id}`);

    // Update order status
    if (refund.attributes.metadata?.order_id) {
      await updateOrderStatus(
        refund.attributes.metadata.order_id,
        'refunded',
        refund.id,
        { refundAmount: refund.attributes.amount / 100 }
      );
    }

    // Create notification
    if (refund.attributes.metadata?.user_id) {
      await createPaymentNotification(
        refund.attributes.metadata.user_id,
        'Payment Refunded',
        `Your payment of ₱${(refund.attributes.amount / 100).toFixed(2)} has been refunded.`,
        'info'
      );
    }
  } catch (error) {
    logError(`❌ Error handling payment refunded: ${error.message}`);
  }
}

module.exports = { handlePaymentRefunded };
