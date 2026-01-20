const Order = require('../../models/Order');
const { getJSON, setJSON } = require('../../utils/redis');
const { formatDate } = require('../../utils/logging');

/**
 * @desc    Get order by ID
 * @route   GET /api/pos/orders/:orderId
 * @access  Public
 */
exports.getOrderById = async (req, res) => {
  const startTime = Date.now();
  const startTimeFormatted = formatDate(startTime);
  const { orderId } = req.params;
  console.log(`\n[${startTimeFormatted}] - 🆔 GET ORDER BY ID REQUEST | Order ID: ${orderId} | IP: ${req.ip}`);

  try {
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required',
        statusCode: 400
      });
    }

    const orderCacheKey = `order:${orderId}`;

    // Check Redis cache first
    const cachedOrder = await getJSON(orderCacheKey);
    if (cachedOrder) {
      console.log(`[${startTimeFormatted}] - 🎯 Redis cache HIT for order: ${orderId}`);
      const responseTime = Date.now() - startTime;
      console.log(`[${startTimeFormatted}] - ✅ GET ORDER BY ID SUCCESSFUL (from cache) | Total time: ${responseTime}ms`);
      return res.status(200).json({
        success: true,
        source: 'cache',
        data: cachedOrder,
        statusCode: 200
      });
    }

    console.log(`[${startTimeFormatted}] - 🗄️ Redis cache MISS for order: ${orderId}`);

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

    // Cache the order for 1 hour
    await setJSON(orderCacheKey, order, 3600);
    console.log(`[${startTimeFormatted}] - 💾 Order cached in Redis for 1 hour: ${orderId}`);

    const responseTime = Date.now() - startTime;
    console.log(`[${startTimeFormatted}] - ✅ GET ORDER BY ID SUCCESSFUL (from DB) | Total time: ${responseTime}ms`);

    res.status(200).json({
      success: true,
      source: 'database',
      data: order,
      statusCode: 200
    });

  } catch (error) {
    console.error(`[${startTimeFormatted}] - 💥 GET ORDER BY ID ERROR: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      statusCode: 500
    });
  }
};
