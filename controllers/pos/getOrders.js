const Order = require('../../models/Order');
const { getJSON, setJSON } = require('../../utils/redis');
const { formatDate } = require('../../utils/logging');

/**
 * @desc    Get all orders with pagination and filtering
 * @route   GET /api/pos/orders
 * @access  Private (Admin/Cashier only)
 */
exports.getOrders = async (req, res) => {
  const startTime = Date.now();
  const startTimeFormatted = formatDate(startTime);
  console.log(`\n[${startTimeFormatted}] - 📦 GET ORDERS REQUEST | User: ${req.user?.email} | IP: ${req.ip}`);

  try {
    const { page = 1, limit = 10, status, customer, startDate, endDate, sortBy = 'date', sortOrder = 'desc' } = req.query;

    // Create a dynamic cache key based on query parameters
    const cacheKey = `orders:${JSON.stringify(req.query)}`;

    // Check Redis cache first
    const cachedData = await getJSON(cacheKey);
    if (cachedData) {
      console.log(`[${startTimeFormatted}] - 🎯 Redis cache HIT for orders query: ${cacheKey}`);
      const responseTime = Date.now() - startTime;
      console.log(`[${startTimeFormatted}] - ✅ GET ORDERS SUCCESSFUL (from cache) | Total time: ${responseTime}ms`);
      return res.status(200).json({
        success: true,
        source: 'cache',
        ...cachedData,
        statusCode: 200
      });
    }

    console.log(`[${startTimeFormatted}] - 🗄️ Redis cache MISS for orders query: ${cacheKey}`);
    
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        statusCode: 401
      });
    }

    // Check if user has permission to access all orders
    // Allow admin and cashier roles (cashier role comes from CASHIER_KEY)
    if (req.user.role === 'user') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Users can only view their own orders.',
        statusCode: 403
      });
    }
    
    // Build query
    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (customer) {
      query['customer.userid'] = { $regex: customer, $options: 'i' };
    }
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = new Date(startDate);
      }
      if (endDate) {
        query.date.$lte = new Date(endDate);
      }
    }

    // Pagination
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Sort options
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with population
    const orders = await Order.find(query)
      .populate('items.product', '-__v')
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get total count for pagination
    const total = await Order.countDocuments(query);

    const responseData = {
      data: {
        orders,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    };

    // Cache the response data for 5 minutes
    await setJSON(cacheKey, responseData, 300);
    console.log(`[${startTimeFormatted}] - 💾 Orders query result cached in Redis for 5 minutes: ${cacheKey}`);

    const responseTime = Date.now() - startTime;
    console.log(`[${startTimeFormatted}] - ✅ GET ORDERS SUCCESSFUL (from DB) | Total time: ${responseTime}ms`);

    res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      },
      statusCode: 200
    });

  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      statusCode: 500
    });
  }
};
