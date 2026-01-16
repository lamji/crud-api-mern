const paymongoService = require('./index');

/**
 * @desc    Process Refund Payment (Admin only)
 * @route   POST /api/payments/refund
 * @access  Private (Admin only)
 */
exports.refundPayment = async (req, res) => {
  try {
    const { paymentId, amount, reason } = req.body;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: 'Payment ID is required',
        statusCode: 400
      });
    }

    // Only admins can process refunds
    if (req.user.role !== process.env.ADMIN_KEY) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only admins can process refunds.',
        statusCode: 403
      });
    }

    // Process refund
    const refund = await paymongoService.refundPayment(
      paymentId,
      amount,
      reason || 'requested_by_customer'
    );

    res.status(201).json({
      success: true,
      message: 'Refund processed successfully',
      data: {
        refundId: refund.data.id,
        paymentId: refund.data.attributes.payment_id,
        amount: refund.data.attributes.amount / 100,
        currency: refund.data.attributes.currency,
        status: refund.data.attributes.status,
        reason: refund.data.attributes.reason
      }
    });

  } catch (error) {
    console.error('Refund payment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to process refund',
      statusCode: 500
    });
  }
};
