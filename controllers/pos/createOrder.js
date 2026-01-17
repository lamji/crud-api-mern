const Order = require('../../models/Order');
const Product = require('../../models/Product');
const User = require('../../models/User');
const { setJSON } = require('../../utils/redis');
const { formatDate } = require('../../utils/logging');

/**
 * @desc    Create new order
 * @route   POST /api/pos/orders
 * @access  Private
 */
exports.createOrder = async (req, res) => {
  const startTime = Date.now();
  const startTimeFormatted = formatDate(startTime);
  console.log(`\n[${startTimeFormatted}] - 🛒 CREATE ORDER REQUEST | User: ${req.user?.email} | IP: ${req.ip}`);
  try {
    const { customer, items, paymentMethod, deliveryType, deliveryFee } = req.body;

    // Get user ID from token
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required',
        statusCode: 401
      });
    }

    // Validate required fields
    if (!customer || !customer.phonenumber || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: customer.phonenumber, items',
        statusCode: 400
      });
    }

    // Validate delivery type
    if (deliveryType && !['pickup', 'delivery'].includes(deliveryType)) {
      return res.status(400).json({
        success: false,
        message: 'Delivery type must be pickup or delivery',
        statusCode: 400
      });
    }

    // Validate address for delivery orders
    if (deliveryType === 'delivery' && !customer.address) {
      return res.status(400).json({
        success: false,
        message: 'Address is required for delivery orders',
        statusCode: 400
      });
    }

    // Validate payment method
    if (!paymentMethod || !paymentMethod.type) {
      return res.status(400).json({
        success: false,
        message: 'Payment method type is required',
        statusCode: 400
      });
    }

    // Validate phone number format
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    if (!phoneRegex.test(customer.phonenumber)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format',
        statusCode: 400
      });
    }

    // Validate payment method details based on type
    if (paymentMethod.type === 'card') {
      if (!paymentMethod.details || !paymentMethod.details.cardType || !paymentMethod.details.lastFour || !paymentMethod.details.transactionId) {
        return res.status(400).json({
          success: false,
          message: 'Card payment requires: cardType, lastFour, transactionId',
          statusCode: 400
        });
      }
    } else if (paymentMethod.type === 'ewallet') {
      if (!paymentMethod.details || !paymentMethod.details.provider || !paymentMethod.details.accountEmail || !paymentMethod.details.transactionId) {
        return res.status(400).json({
          success: false,
          message: 'E-wallet payment requires: provider, accountEmail, transactionId',
          statusCode: 400
        });
      }
    } else if (paymentMethod.type === 'cash') {
      // For cash payments, details should be null
      if (paymentMethod.details !== null && paymentMethod.details !== undefined) {
        return res.status(400).json({
          success: false,
          message: 'Cash payments should have details set to null',
          statusCode: 400
        });
      }
    }

    // Validate product IDs and get product details
    const productIds = items.map(item => item.product);
    const products = await Product.find({ _id: { $in: productIds } });
    
    if (products.length !== productIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more products not found',
        statusCode: 400
      });
    }

    // Generate unique order ID
    const orderId = `ORD-${Date.now().toString(36).toUpperCase()}`;

    // Calculate subtotal
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Calculate delivery fee
    const deliveryFeeAmount = deliveryFee || (deliveryType === 'delivery' ? 5.99 : 0);
    
    // Calculate total
    const total = subtotal + deliveryFeeAmount;

    // Create order
    const order = await Order.create({
      id: orderId,
      customer: {
        userid: userId, // Use user ID from token
        address: customer.address || null,
        phonenumber: customer.phonenumber
      },
      items,
      total,
      deliveryType: deliveryType || 'pickup',
      deliveryFee: deliveryFeeAmount,
      paymentMethod: {
        type: paymentMethod.type,
        details: paymentMethod.details
      }
    });

    // Add order to user's orders array
    await User.findByIdAndUpdate(
      userId, // Use user ID from token
      { $push: { orders: order._id } },
      { new: true }
    );

    // Populate product details for response
    const populatedOrder = await Order.findById(order._id)
      .populate('items.product', '-__v')
      .lean();

    // Cache the newly created order for 1 hour
    const orderCacheKey = `order:${populatedOrder.id}`;
    await setJSON(orderCacheKey, populatedOrder, 3600);
    console.log(`[${startTimeFormatted}] - 💾 Order cached in Redis for 1 hour: ${populatedOrder.id}`);

    const responseTime = Date.now() - startTime;
    console.log(`[${startTimeFormatted}] - ✅ ORDER CREATED SUCCESSFULLY | Total time: ${responseTime}ms`);

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: populatedOrder,
      statusCode: 201
    });

  } catch (error) {
    console.error('Error creating order:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(err => err.message),
        statusCode: 400
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Order ID already exists',
        statusCode: 400
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      statusCode: 500
    });
  }
};
