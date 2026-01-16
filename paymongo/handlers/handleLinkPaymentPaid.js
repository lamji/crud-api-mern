const { updateOrderStatus } = require('./updateOrderStatus');
const { logError, formatDate } = require('../../utils/logging');

async function handleLinkPaymentPaid(event) {
  try {
    const link = event; // event is already the link object
    console.log(`[${formatDate()}] - 🔗 DEBUG: Link payment event received`);
    console.log(`[${formatDate()}] - 🔗 Link payment paid: ${link.id}`);

    // Extract order ID from description
    const description = link.attributes.description;
    const orderIdMatch = description.match(/Order (ORD-\w+-\w+)/);
    const orderId = orderIdMatch ? orderIdMatch[1] : null;

    if (orderId) {
      console.log(`[${formatDate()}] - 🎯 Extracted order ID from description: ${orderId}`);
      
      // Extract full payment details from the event
      const payment = link.attributes.payments[0];
      const paymentDetails = {
        paymentMethod: {
          type: payment.data.attributes.source.type,
          source: payment.data.attributes.source,
          billing: payment.data.attributes.billing,
          transaction: {
            id: link.id,
            externalReference: link.attributes.reference_number,
            description: description,
            statementDescriptor: 'PAYMONGO'
          },
          amounts: {
            gross: payment.data.attributes.amount / 100,
            fee: (payment.data.attributes.fee || 0) / 100,
            net: (payment.data.attributes.amount - (payment.data.attributes.fee || 0)) / 100,
            currency: payment.data.attributes.currency
          },
          timestamps: {
            paidAt: new Date(payment.data.attributes.paid_at * 1000),
            createdAt: new Date(payment.data.attributes.created_at * 1000),
            availableAt: new Date(payment.data.attributes.available_at * 1000)
          },
          status: payment.data.attributes.status,
          origin: 'links'
        },
        paymentLinkId: link.id,
        paymentReference: link.attributes.reference_number,
        paymentAmount: payment.data.attributes.amount / 100,
        paymentFee: (payment.data.attributes.fee || 0) / 100,
        paymentNetAmount: (payment.data.attributes.amount - (payment.data.attributes.fee || 0)) / 100,
        paymentCurrency: payment.data.attributes.currency,
        paidAt: new Date(payment.data.attributes.paid_at * 1000)
      };

      console.log(`[${formatDate()}] - 💳 Complete Payment Details Extracted | Type: ${paymentDetails.paymentMethod.type} | Source ID: ${paymentDetails.paymentMethod.source.id} | Billing Name: ${paymentDetails.paymentMethod.billing?.name || 'N/A'} | Gross: ₱${paymentDetails.paymentAmount} | Fee: ₱${paymentDetails.paymentFee} | Net: ₱${paymentDetails.paymentNetAmount}`);

      await updateOrderStatus(orderId, 'paid', link.id, paymentDetails);
    } else {
      logError('❌ Could not extract order ID from payment link description');
    }
  } catch (error) {
    logError(`❌ Error handling link payment paid: ${error.message}`);
  }
}

module.exports = { handleLinkPaymentPaid };
