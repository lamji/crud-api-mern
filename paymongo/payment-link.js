const paymongoService = require('./index');

/**
 * @desc    Create Payment Link
 * @route   POST /api/payments/link
 * @access  Private
 */
exports.createPaymentLink = async (req, res) => {
  try {
    const { amount, description, orderId, userId } = req.body;

    if (!amount) {
      return res.status(400).json({
        success: false,
        message: 'Amount is required',
        statusCode: 400
      });
    }

    // Create metadata with available data
    const metadata = {};
    if (orderId) metadata.order_id = orderId;
    if (userId) metadata.user_id = userId;
    
    // Add source identifier
    metadata.source = 'ecommerce_api';
    metadata.created_at = new Date().toISOString();

    console.log(' Creating payment link with metadata:', metadata);

    // Create payment link
    const paymentLink = await paymongoService.createPaymentLink(
      amount,
      description || 'Payment for Order',
      metadata
    );

    console.log(' Payment link created successfully:', paymentLink.data.id);

    // Extract fee information from PayMongo response
    const linkAttributes = paymentLink.data.attributes;
    const fee = linkAttributes.fee || 0;
    const netAmount = linkAttributes.amount - fee;

    res.status(201).json({
      success: true,
      message: 'Payment link created successfully',
      data: {
        linkId: paymentLink.data.id,
        checkoutUrl: linkAttributes.checkout_url,
        reference: linkAttributes.reference_number,
        amount: linkAttributes.amount / 100,
        currency: linkAttributes.currency,
        status: linkAttributes.status,
        description: linkAttributes.description,
        fee: fee / 100,
        netAmount: netAmount / 100,
        metadata: metadata,
        charges: linkAttributes.charges || []
      }
    });
  } catch (error) {
    console.error(' Create payment link error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: error.response?.data?.errors?.[0]?.detail || 'Failed to create payment link',
      statusCode: 500
    });
  }
};

/**
 * @desc    Get Payment Link Status
 * @route   GET /api/payments/link/:linkId
 * @access  Private
 */
exports.getPaymentLink = async (req, res) => {
  try {
    const { linkId } = req.params;

    if (!linkId) {
      return res.status(400).json({
        success: false,
        message: 'Link ID is required',
        statusCode: 400
      });
    }

    // Get payment link details
    const paymentLink = await paymongoService.getPaymentLink(linkId);

    res.status(200).json({
      success: true,
      message: 'Payment link retrieved successfully',
      data: {
        linkId: paymentLink.data.id,
        checkoutUrl: paymentLink.data.attributes.checkout_url,
        reference: paymentLink.data.attributes.reference_number,
        amount: paymentLink.data.attributes.amount / 100,
        currency: paymentLink.data.attributes.currency,
        status: paymentLink.data.attributes.status,
        description: paymentLink.data.attributes.description,
        payments: paymentLink.data.attributes.payments || []
      }
    });

  } catch (error) {
    console.error('Get payment link error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get payment link',
      statusCode: 500
    });
  }
};
