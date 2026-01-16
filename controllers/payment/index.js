const {
  createPaymentIntent,
  createPaymentMethod,
  attachPaymentMethod,
  createSource,
  getPaymentStatus,
  refundPayment
} = require('./paymentController');

module.exports = {
  createPaymentIntent,
  createPaymentMethod,
  attachPaymentMethod,
  createSource,
  getPaymentStatus,
  refundPayment
};
