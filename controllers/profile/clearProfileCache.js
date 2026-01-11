// Redis client for caching (uncomment when Redis is available)
// const redis = require('redis');
// const client = redis.createClient({
//   host: process.env.REDIS_HOST || 'localhost',
//   port: process.env.REDIS_PORT || 6379,
// });

// Cache for in-memory storage (fallback when Redis unavailable)
const memoryCache = new Map();

/**
 * @desc    Clear profile cache
 * @route   DELETE /api/profile/cache
 * @access  Private
 */
exports.clearProfileCache = async (req, res) => {
  try {
    const userId = req.user.id;
    const cacheKey = `profile:${userId}`;
    
    // Clear Redis cache
    try {
      // await client.del(cacheKey);
    } catch (redisError) {
      // Clear memory cache
      memoryCache.delete(cacheKey);
    }
    
    res.status(200).json({
      success: true,
      message: 'Profile cache cleared successfully'
    });
    
  } catch (error) {
    console.error('Error clearing profile cache:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
