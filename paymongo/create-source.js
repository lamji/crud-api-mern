const Order = require('../models/Order');
const paymongoService = require('./index');

/**
 * @desc    Create Payment Source (for GCash/Maya)
 * @route   POST /api/payments/source
 * @access  Private
 */
exports.createSource = async (req, res) => {
  try {
    const { orderId, type, amount, redirect } = req.body;

    if (!orderId || !type || !amount || !redirect) {
      return res.status(400).json({
        success: false,
        message: 'Order ID, type, amount, and redirect URLs are required',
        statusCode: 400
      });
    }

    // Verify user role (only users can create payment sources)
    if (req.user.role === process.env.ADMIN_KEY || req.user.role === process.env.CASHIER_KEY) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
        statusCode: 403
      });
    }

    // Find order
    const order = await Order.findOne({ id: orderId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
        statusCode: 404
      });
    }

    // Verify order belongs to user
    if (order.customer.userid !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
        statusCode: 403
      });
    }

    // Validate source type
    const validTypes = ['gcash', 'paymaya', 'grab_pay'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid source type. Must be one of: ${validTypes.join(', ')}`,
        statusCode: 400
      });
    }

    // Create source
    const source = await paymongoService.createSource(
      type,
      amount,
      'PHP',
      redirect,
      {
        order_id: orderId,
        user_id: req.user.id
      }
    );

    res.status(201).json({
      success: true,
      message: 'Payment source created successfully',
      data: {
        sourceId: source.data.id,
        type: source.data.attributes.type,
        amount: source.data.attributes.amount / 100,
        currency: source.data.attributes.currency,
        status: source.data.attributes.status,
        redirectUrl: source.data.attributes.redirect?.checkout_url
      }
    });

  } catch (error) {
    console.error('Create source error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create payment source',
      statusCode: 500
    });
  }
};
