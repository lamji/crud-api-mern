const Profile = require('../../models/Profile');

// Redis client for caching (uncomment when Redis is available)
// const redis = require('redis');
// const client = redis.createClient({
//   host: process.env.REDIS_HOST || 'localhost',
//   port: process.env.REDIS_PORT || 6379,
//   retry_strategy: (options) => {
//     if (options.error && options.error.code === 'ECONNREFUSED') {
//       return new Error('Redis server refused connection');
//     }
//     if (options.total_retry_time > 1000 * 60 * 60) {
//       return new Error('Retry time exhausted');
//     }
//     if (options.attempt > 10) {
//       return undefined;
//     }
//     return Math.min(options.attempt * 100, 3000);
//   }
// });

// Cache for in-memory storage (fallback when Redis unavailable)
const memoryCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * @desc    Get current user profile (optimized for high volume)
 * @route   GET /api/profile
 * @access  Private
 */
exports.getProfile = async (req, res) => {
  const startTime = Date.now();
  const userId = req.user.id;
  const cacheKey = `profile:${userId}`;
  
  try {
    // Try cache first (Redis or memory fallback)
    let cachedProfile = null;
    
    // Try Redis cache (if available)
    try {
      // const cached = await client.get(cacheKey);
      // if (cached) {
      //   cachedProfile = JSON.parse(cached);
      // }
    } catch (redisError) {
      console.warn('Redis cache unavailable, using memory cache');
    }
    
    // Fallback to memory cache
    if (!cachedProfile && memoryCache.has(cacheKey)) {
      const cached = memoryCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        cachedProfile = cached.data;
      } else {
        memoryCache.delete(cacheKey);
      }
    }
    
    if (cachedProfile) {
      console.log(`Cache hit for user ${userId}, response time: ${Date.now() - startTime}ms`);
      return res.status(200).json({
        success: true,
        data: cachedProfile,
        cached: true
      });
    }
    
    // Cache miss - fetch from database with optimized query
    const profile = await Profile.findOne({ 
      userId: userId 
    }).select('-__v -updatedAt -_id -userId') // Exclude unnecessary fields including _id and userId
      .lean(); // Return plain JavaScript object for better performance
    
    if (!profile) {
      // Create a default profile if it doesn't exist
      const defaultProfile = await Profile.create({
        userId: userId,
        firstName: req.user.name?.split(' ')[0] || 'User',
        lastName: req.user.name?.split(' ').slice(1).join(' ') || '',
        email: req.user.email,
        preferences: {
          newsletter: false,
          smsNotifications: false,
          pushNotifications: false,
          language: 'en',
          currency: 'PHP'
        }
      });
      
      // Remove _id and userId from response
      const { _id, userId: removedUserId, ...profileResponse } = defaultProfile.toObject();
      
      // Cache the new profile (without ID fields)
      await cacheProfile(cacheKey, profileResponse);
      
      console.log(`Created and cached new profile for user ${userId}, response time: ${Date.now() - startTime}ms`);
      return res.status(200).json({
        success: true,
        data: profileResponse,
        cached: false
      });
    }
    
    // Cache the fetched profile
    await cacheProfile(cacheKey, profile);
    
    console.log(`Database hit for user ${userId}, response time: ${Date.now() - startTime}ms`);
    res.status(200).json({
      success: true,
      data: profile,
      cached: false
    });
    
  } catch (error) {
    console.error(`Error fetching profile for user ${userId}:`, error);
    
    // Return cached data if available even on error (graceful degradation)
    const fallbackCache = memoryCache.get(cacheKey);
    if (fallbackCache && Date.now() - fallbackCache.timestamp < CACHE_TTL * 2) {
      console.log(`Graceful degradation: serving stale cache for user ${userId}`);
      return res.status(200).json({
        success: true,
        data: fallbackCache.data,
        cached: true,
        stale: true
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      requestId: req.id // Add request ID for debugging
    });
  }
};

/**
 * Helper function to cache profile data
 */
async function cacheProfile(cacheKey, profile) {
  try {
    // Try Redis cache first
    // await client.setex(cacheKey, 300, JSON.stringify(profile)); // 5 minutes
  } catch (redisError) {
    // Fallback to memory cache
    memoryCache.set(cacheKey, {
      data: profile,
      timestamp: Date.now()
    });
    
    // Clean up old cache entries periodically
    if (memoryCache.size > 1000) {
      cleanupMemoryCache();
    }
  }
}

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

// Export cache utilities for other modules
module.exports.cacheProfile = cacheProfile;
module.exports.cleanupMemoryCache = cleanupMemoryCache;
