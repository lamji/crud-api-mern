const Order = require('../../models/Order');

/**
 * @desc    Get order by ID
 * @route   GET /api/pos/orders/:orderId
 * @access  Public
 */
exports.getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required',
        statusCode: 400
      });
    }

    const order = await Order.findOne({ id: orderId })
      .populate('items.product', '-__v')
      .lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
        statusCode: 404
      });
    }

    res.status(200).json({
      success: true,
      data: order,
      statusCode: 200
    });

  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      statusCode: 500
    });
  }
};
