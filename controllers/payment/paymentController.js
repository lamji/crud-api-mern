const paymongoService = require('../../paymongo/index');
const Order = require('../../models/Order');
const { protect } = require('../../middleware/auth');
const { createPaymentIntent } = require('../../paymongo/payment-intent');
const { createPaymentMethod, attachPaymentMethod } = require('../../paymongo/attach-method');
const { createSource } = require('../../paymongo/create-source');
const { getPaymentStatus } = require('../../paymongo/payment-status');
const { refundPayment } = require('../../paymongo/refund-payment');
const { createPaymentLink, getPaymentLink } = require('../../paymongo/payment-link');

// Re-export all functions from paymongo directory
exports.createPaymentIntent = createPaymentIntent;
exports.createPaymentMethod = createPaymentMethod;
exports.attachPaymentMethod = attachPaymentMethod;
exports.createSource = createSource;
exports.getPaymentStatus = getPaymentStatus;
exports.refundPayment = refundPayment;
exports.createPaymentLink = createPaymentLink;
exports.getPaymentLink = getPaymentLink;
