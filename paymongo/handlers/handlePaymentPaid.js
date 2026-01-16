const { updateOrderStatus } = require('./updateOrderStatus');
const { logError, formatDate } = require('../../utils/logging');

async function handlePaymentPaid(event) {
  try {
    const payment = event; // event is already the payment object
    console.log(`[${formatDate()}] - 💰 PAYMENT PAID | ID: ${payment.id}`);

    // Update order status if payment is linked to an order
    if (payment.attributes.metadata?.order_id) {
      await updateOrderStatus(
        payment.attributes.metadata.order_id,
        'paid',
        payment.id,
        {
          paymentMethod: 'online',
          paymentReference: payment.attributes.external_reference_number,
          paymentAmount: payment.attributes.amount / 100,
          paymentFee: (payment.attributes.fee || 0) / 100,
          paymentNetAmount: (payment.attributes.amount - (payment.attributes.fee || 0)) / 100,
          paymentCurrency: payment.attributes.currency,
          paidAt: new Date()
        }
      );
    } else {
      console.log(`[${formatDate()}] - ⚠️  Payment not linked to any order`);
    }
  } catch (error) {
    logError(`❌ Error handling payment paid: ${error.message}`);
  }
}

module.exports = { handlePaymentPaid };
