const Product = require('../../models/Product');

// Cache for in-memory storage (fallback when Redis unavailable)
const memoryCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * @desc    Get product by ID
 * @route   GET /api/products/:id
 * @access  Public
 */
exports.getProductById = async (req, res) => {
  const startTime = Date.now();
  const { id } = req.params;
  const cacheKey = `product:${id}`;
  
  try {
    // Try cache first
    if (memoryCache.has(cacheKey)) {
      const cached = memoryCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`Cache hit for product ${id}, response time: ${Date.now() - startTime}ms`);
        return res.status(200).json({
          success: true,
          data: cached.data,
          cached: true
        });
      } else {
        memoryCache.delete(cacheKey);
      }
    }

    // Find product by MongoDB _id
    const product = await Product.findById(id)
      .select('-__v') // Exclude verbose fields
      .lean(); // Return plain JavaScript object for better performance

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Cache the result
    memoryCache.set(cacheKey, {
      data: product,
      timestamp: Date.now()
    });

    // Clean up old cache entries periodically
    if (memoryCache.size > 500) {
      cleanupMemoryCache();
    }

    console.log(`Database hit for product ${id}, response time: ${Date.now() - startTime}ms`);
    
    res.status(200).json({
      success: true,
      data: product,
      cached: false
    });

  } catch (error) {
    console.error(`Error fetching product ${id}:`, error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }
    
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
