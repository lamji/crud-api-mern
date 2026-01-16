const Order = require('../models/Order');
const paymongoService = require('./index');

/**
 * @desc    Create Payment Intent
 * @route   POST /api/payments/intent
 * @access  Private
 */
exports.createPaymentIntent = async (req, res) => {
  try {
    const { amount, paymentMethodAllowed = ['card', 'gcash', 'paymaya'] } = req.body;

    // Create payment intent
    const paymentIntent = await paymongoService.createPaymentIntent(
      amount,
      'PHP',
      paymentMethodAllowed,
      {
        user_id: req.user.id
      }
    );

    res.status(201).json({
      success: true,
      message: 'Payment intent created successfully',
      data: {
        paymentIntentId: paymentIntent.data.id,
        clientKey: paymentIntent.data.attributes.client_key,
        amount: amount,
        currency: 'PHP',
        status: paymentIntent.data.attributes.status
      }
    });

  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create payment intent',
      statusCode: 500
    });
  }
};