const Product = require('../../models/Product');

// Cache for in-memory storage (fallback when Redis unavailable)
const memoryCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * @desc    Get all products with pagination and filtering
 * @route   GET /api/products
 * @access  Public
 */
exports.getAllProducts = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { 
      page = 1, 
      limit = 20, 
      category, 
      type, 
      minPrice, 
      maxPrice,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Convert to numbers
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Create cache key
    const cacheKey = `product-list:${JSON.stringify({ page, limit, category, type, minPrice, maxPrice, search, sortBy, sortOrder })}`;
    
    // Try cache first
    if (memoryCache.has(cacheKey)) {
      const cached = memoryCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`Cache hit for product list, response time: ${Date.now() - startTime}ms`);
        return res.status(200).json({
          success: true,
          data: cached.data,
          cached: true
        });
      } else {
        memoryCache.delete(cacheKey);
      }
    }

    // Build query
    const query = {};
    
    if (category) query.category = category;
    if (type) query.type = type;
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }
    
    if (search) {
      query.$text = { $search: search };
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const [products, total] = await Promise.all([
      Product.find(query)
        .select('-__v -reviews') // Exclude verbose fields
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(), // Return plain JavaScript object for better performance
      Product.countDocuments(query)
    ]);

    const result = {
      products,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalProducts: total,
        hasNext: pageNum < Math.ceil(total / limitNum),
        hasPrev: pageNum > 1
      },
      filters: {
        category,
        type,
        minPrice,
        maxPrice,
        search,
        sortBy,
        sortOrder
      }
    };

    // Cache the result
    memoryCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    // Clean up old cache entries periodically
    if (memoryCache.size > 100) {
      cleanupMemoryCache();
    }

    console.log(`Database hit for product list, response time: ${Date.now() - startTime}ms`);
    
    res.status(200).json({
      success: true,
      data: result,
      cached: false
    });

  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      requestId: req.id
    });
  }
};

/**
 * Clean up expired memory cache entries
 */
function cleanupMemoryCache() {
  const now = Date.now();
  for (const [key, value] of memoryCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      memoryCache.delete(key);
    }
  }
}

module.exports.cleanupMemoryCache = cleanupMemoryCache;
