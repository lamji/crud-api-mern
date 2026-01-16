const paymongoService = require('./index');

/**
 * @desc    Create Payment Method (for cards)
 * @route   POST /api/payments/method
 * @access  Private
 */
exports.createPaymentMethod = async (req, res) => {
  try {
    const { type, details, billing } = req.body;

    if (!type || !details) {
      return res.status(400).json({
        success: false,
        message: 'Payment method type and details are required',
        statusCode: 400
      });
    }

    // Validate payment method type
    const validTypes = ['card'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid payment method type. Must be one of: ${validTypes.join(', ')}`,
        statusCode: 400
      });
    }

    // Create payment method
    const paymentMethod = await paymongoService.createPaymentMethod(type, details, billing);

    res.status(201).json({
      success: true,
      message: 'Payment method created successfully',
      data: {
        paymentMethodId: paymentMethod.data.id,
        type: paymentMethod.data.attributes.type,
        details: paymentMethod.data.attributes.details
      }
    });

  } catch (error) {
    console.error('Create payment method error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create payment method',
      statusCode: 500
    });
  }
};

/**
 * @desc    Attach Payment Method to Payment Intent
 * @route   POST /api/payments/attach
 * @access  Private
 */
exports.attachPaymentMethod = async (req, res) => {
  try {
    const { paymentIntentId, paymentMethodId, returnUrl } = req.body;

    if (!paymentIntentId || !paymentMethodId) {
      return res.status(400).json({
        success: false,
        message: 'Payment intent ID and payment method ID are required',
        statusCode: 400
      });
    }

    // Attach payment method
    const payment = await paymongoService.attachPaymentMethod(
      paymentIntentId,
      paymentMethodId,
      returnUrl
    );

    res.status(200).json({
      success: true,
      message: 'Payment method attached successfully',
      data: {
        paymentId: payment.data.id,
        status: payment.data.attributes.status,
        amount: payment.data.attributes.amount / 100,
        currency: payment.data.attributes.currency
      }
    });

  } catch (error) {
    console.error('Attach payment method error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to attach payment method',
      statusCode: 500
    });
  }
};