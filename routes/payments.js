const express = require('express');
const router = express.Router();
const {
  createPaymentIntent,
  createPaymentMethod,
  attachPaymentMethod,
  createSource,
  getPaymentStatus,
  refundPayment,
  createPaymentLink,
  getPaymentLink
} = require('../controllers/payment/paymentController');
const {
  validatePaymentIntent,
  validatePaymentMethod,
  validateAttachPayment,
  validateSource,
  validateRefund,
  validatePaymentLink
} = require('../validators/paymentValidator');
const { protect } = require('../middleware/auth');
const { PayMongoWebhookHandler } = require('../paymongo/webhook');
const webhookHandler = new PayMongoWebhookHandler();

// Payment Intent routes
router.post('/intent', protect, validatePaymentIntent, createPaymentIntent);

// Payment Method routes
router.post('/method', protect, validatePaymentMethod, createPaymentMethod);
router.post('/attach', protect, validateAttachPayment, attachPaymentMethod);

// Payment Source routes (for e-wallets)
router.post('/source', protect, validateSource, createSource);

// Payment Link routes (user can choose payment method)
router.post('/link', protect, validatePaymentLink, createPaymentLink);
router.get('/link/:linkId', protect, getPaymentLink);

// Payment Status routes
router.get('/:paymentId', protect, getPaymentStatus);

// Refund routes
router.post('/refund', protect, validateRefund, refundPayment);

// Webhook route (no auth required - PayMongo only)
router.post('/webhook', (req, res) => webhookHandler.handleWebhook(req, res));

module.exports = router;
