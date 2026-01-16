const { logError, formatDate } = require('../../utils/logging');

async function handlePaymentRefundUpdated(event) {
  try {
    const refund = event.data;
    console.log(`[${formatDate()}] - 💰 PAYMENT REFUND UPDATED | ID: ${refund.id}`);
    // Business logic for refund updates can be added here
  } catch (error) {
    logError(`❌ Error handling payment refund updated: ${error.message}`);
  }
}

module.exports = { handlePaymentRefundUpdated };
