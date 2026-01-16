const paymongoService = require('./index');
const { formatDate, logError } = require('../utils/logging');
const { handlePaymentPaid } = require('./handlers/handlePaymentPaid');
const { handlePaymentFailed } = require('./handlers/handlePaymentFailed');
const { handlePaymentRefunded } = require('./handlers/handlePaymentRefunded');
const { handlePaymentRefundUpdated } = require('./handlers/handlePaymentRefundUpdated');
const { handleLinkPaymentPaid } = require('./handlers/handleLinkPaymentPaid');

class PayMongoWebhookHandler {
  constructor() {
    this.eventHandlers = {
      'payment.paid': handlePaymentPaid,
      'payment.failed': handlePaymentFailed,
      'payment.refunded': handlePaymentRefunded,
      'payment.refund.updated': handlePaymentRefundUpdated,
      'link.payment.paid': handleLinkPaymentPaid,
    };
  }

  // Main webhook handler
  async handleWebhook(req, res) {
    const startTime = new Date();
    console.log(`\n[${formatDate(startTime)}] - 🔔 PAYMONGO WEBHOOK REQUEST RECEIVED | Endpoint: ${req.method} ${req.originalUrl} | Event: ${req.body?.data?.attributes?.type || 'UNKNOWN'} | ID: ${req.body?.data?.id || 'N/A'}`);
    
    try {
      const signature = req.headers['paymongo-signature'];
      const payload = JSON.stringify(req.body);

      // Log webhook request details
      console.log(`[${formatDate()}] - 🔐 Signature Present: ${!!signature ? 'YES' : 'NO'} | Payload Size: ${payload.length} bytes`);

      // Verify webhook signature (optional but recommended)
      if (signature && !paymongoService.verifyWebhookSignature(payload, signature)) {
        logError('❌ INVALID WEBHOOK SIGNATURE');
        console.log(`[${formatDate()}] - 🔍 Signature: ${signature}`);
        return res.status(401).json({ error: 'Invalid signature' });
      }

      const event = req.body;
      const eventType = event?.data?.attributes?.type;

      // Log event details
      console.log(`[${formatDate()}] - 🎯 EVENT DETAILS | Type: ${eventType} | Livemode: ${event?.data?.attributes?.livemode ? 'YES' : 'NO'} | Created: ${event?.data?.attributes?.created_at ? new Date(event?.data?.attributes?.created_at * 1000).toISOString() : 'N/A'}`);
      
      // Log specific event data based on type
      if (eventType === 'payment.paid') {
        const payment = event?.data?.attributes?.data;
        console.log(`[${formatDate()}] - 💰 PAYMENT | ID: ${payment?.id || 'N/A'} | Amount: ${payment?.attributes?.amount ? `₱${(payment.attributes.amount / 100).toFixed(2)}` : 'N/A'} | Currency: ${payment?.attributes?.currency || 'N/A'} | Status: ${payment?.attributes?.status || 'N/A'} | Source: ${payment?.attributes?.source?.type || 'N/A'}`);
      } else if (eventType === 'link.payment.paid') {
        const link = event?.data?.attributes?.data;
        console.log(`[${formatDate()}] - 🔗 LINK PAYMENT | ID: ${link?.id || 'N/A'} | Amount: ${link?.attributes?.amount ? `₱${(link.attributes.amount / 100).toFixed(2)}` : 'N/A'} | Reference: ${link?.attributes?.reference_number || 'N/A'} | Status: ${link?.attributes?.status || 'N/A'}`);
      }

      console.log(`[${formatDate()}] - 🔄 Processing PayMongo webhook event: ${eventType}`);

      // Handle the event
      if (this.eventHandlers[eventType]) {
        console.log(`[${formatDate()}] - ✅ Handler found for ${eventType} - Executing...`);
        
        // Extract the actual data object based on event type
        let eventData;
        if (eventType === 'link.payment.paid') {
          eventData = event?.data?.attributes?.data;
        } else if (eventType === 'payment.paid') {
          eventData = event?.data?.attributes?.data;
        } else {
          eventData = event?.data?.attributes?.data;
        }
        
        await this.eventHandlers[eventType](eventData);
        console.log(`[${formatDate()}] - ✅ Handler completed for ${eventType}`);
      } else {
        console.log(`[${formatDate()}] - ⚠️  No handler for event type: ${eventType}`);
        console.log(`[${formatDate()}] - 📋 Available handlers: ${Object.keys(this.eventHandlers).join(', ')}`);
      }

      // Log response
      console.log(`[${formatDate()}] - 📤 SENDING WEBHOOK RESPONSE | Status: 200 OK | Processing Time: ${Date.now() - startTime.getTime()}ms`);

      // Respond with 200 status as required by PayMongo
      res.status(200).json({ 
        statusCode: 200,
        body: { message: 'SUCCESS' }
      });

      console.log(`[${formatDate()}] - ✅ WEBHOOK PROCESSING COMPLETED SUCCESSFULLY\n`);
    } catch (error) {
      logError(`❌ WEBHOOK PROCESSING ERROR: ${error.message}`);
      logError(`📍 Stack Trace: ${error.stack}`);
      logError(`📦 Request Body: ${JSON.stringify(req.body)}`);
      
      // Still respond with 200 to acknowledge receipt
      console.log(`[${formatDate()}] - 📤 SENDING ERROR RESPONSE (200 to acknowledge) | Processing Time: ${Date.now() - startTime.getTime()}ms`);
      res.status(200).json({ 
        statusCode: 200,
        body: { message: 'SUCCESS' }
      });
      
      console.log(`[${formatDate()}] - ✅ WEBHOOK ERROR HANDLING COMPLETED\n`);
    }
  }

}
// Export class for instantiation
module.exports = { PayMongoWebhookHandler };
