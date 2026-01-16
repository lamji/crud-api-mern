const paymongoService = require('./index');

/**
 * @desc    Get Payment Status
 * @route   GET /api/payments/:paymentId
 * @access  Private
 */
exports.getPaymentStatus = async (req, res) => {
  try {
    const { paymentId } = req.params;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: 'Payment ID is required',
        statusCode: 400
      });
    }

    // Get payment details
    const payment = await paymongoService.getPayment(paymentId);

    res.status(200).json({
      success: true,
      message: 'Payment status retrieved successfully',
      data: {
        paymentId: payment.data.id,
        status: payment.data.attributes.status,
        amount: payment.data.attributes.amount / 100,
        currency: payment.data.attributes.currency,
        paidAt: payment.data.attributes.paid_at,
        source: {
          type: payment.data.attributes.source?.type,
          id: payment.data.attributes.source?.id
        },
        metadata: payment.data.attributes.metadata
      }
    });

  } catch (error) {
    console.error('Get payment status error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get payment status',
      statusCode: 500
    });
  }
};
