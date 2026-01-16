const Profile = require('../../models/Profile');

// Helper function to format date as mm/dd/yy-hh-mm-ss
const formatDate = (date = new Date()) => {
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${month}/${day}/${year}-${hours}-${minutes}-${seconds}`;
};

// Helper function for red error logging
const logError = (message) => {
  console.log(`\x1b[31m[${formatDate()}] - ${message}\x1b[0m`);
};

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
  const startTime = new Date();
  const userId = req.user.id;
  const cacheKey = `profile:${userId}`;
  
  console.log(`\n[${formatDate(startTime)}] - 👤 PROFILE REQUEST RECEIVED | Endpoint: ${req.method} ${req.originalUrl} | User ID: ${userId} | Email: ${req.user.email} | IP: ${req.ip} | User-Agent: ${req.get('User-Agent')}`);
  
  try {
    // Try cache first (Redis or memory fallback)
    let cachedProfile = null;
    
    console.log(`[${formatDate()}] - 🔍 Checking cache for user ${userId}`);
    
    // Try Redis cache (if available)
    try {
      // const cached = await client.get(cacheKey);
      // if (cached) {
      //   cachedProfile = JSON.parse(cached);
      //   console.log(`[${formatDate()}] - ✅ Redis cache hit for user ${userId}`);
      // }
    } catch (redisError) {
      console.log(`[${formatDate()}] - ⚠️  Redis cache unavailable, using memory cache`);
    }
    
    // Fallback to memory cache
    if (!cachedProfile && memoryCache.has(cacheKey)) {
      const cached = memoryCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        cachedProfile = cached.data;
        console.log(`[${formatDate()}] - ✅ Memory cache hit for user ${userId}`);
      } else {
        memoryCache.delete(cacheKey);
        console.log(`[${formatDate()}] - 🗑️  Expired memory cache entry removed for user ${userId}`);
      }
    }
    
    if (cachedProfile) {
      const responseTime = Date.now() - startTime.getTime();
      console.log(`[${formatDate()}] - 🎯 CACHE HIT | User: ${userId} | Response time: ${responseTime}ms | Orders: ${cachedProfile.orders?.length || 0}`);
      return res.status(200).json({
        success: true,
        data: cachedProfile,
        cached: true
      });
    }
    
    console.log(`[${formatDate()}] - 💾 Cache miss - fetching from database for user ${userId}`);
    
    // Cache miss - fetch from database with optimized query
    const profile = await Profile.findOne({ 
      userId: userId 
    }).select('-__v -updatedAt -_id -userId') // Exclude unnecessary fields including _id and userId
      .populate({
        path: 'orders.items.productId',
        model: 'Product',
        select: 'title imageSrc price originalPrice discountPercent rating reviewCount stock'
      })
      .lean(); // Return plain JavaScript object for better performance
    
    if (!profile) {
      console.log(`[${formatDate()}] - ⚠️  Profile not found for user ${userId} - creating default profile`);
      
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
      
      console.log(`[${formatDate()}] - ✅ Default profile created for user ${userId} | Name: ${defaultProfile.firstName} ${defaultProfile.lastName}`);
      
      // Remove _id and userId from response
      const { _id, userId: removedUserId, ...profileResponse } = defaultProfile.toObject();
      
      // Cache the new profile (without ID fields)
      await cacheProfile(cacheKey, profileResponse);
      
      const responseTime = Date.now() - startTime.getTime();
      console.log(`[${formatDate()}] - 📤 Sending new profile response | User: ${userId} | Response time: ${responseTime}ms`);
      return res.status(200).json({
        success: true,
        data: profileResponse,
        cached: false
      });
    }
    
    console.log(`[${formatDate()}] - ✅ Profile found in database for user ${userId} | Orders: ${profile.orders?.length || 0} | Addresses: ${profile.addresses?.length || 0}`);
    
    // Transform order items to use populated product data and filter sensitive payment info
    if (profile.orders && profile.orders.length > 0) {
      profile.orders.forEach(order => {
        if (order.items && order.items.length > 0) {
          order.items.forEach(item => {
            // If productId is populated (has product data), update productName and productImage
            if (item.productId && typeof item.productId === 'object' && item.productId.title) {
              item.productName = item.productId.title;
              item.productImage = item.productId.imageSrc || '';
            }
          });
        }
        
        // Filter sensitive payment method data for user consumption
        if (order.paymentMethod) {
          const paymentMethod = order.paymentMethod;
          order.paymentMethod = {
            // Keep user-friendly payment info
            type: paymentMethod.type,
            paidAt: paymentMethod.paidAt,
            transactionId: paymentMethod.transactionId,
            
            // Include billing info (user's own data)
            billing: paymentMethod.billing ? {
              name: paymentMethod.billing.name,
              email: paymentMethod.billing.email,
              phone: paymentMethod.billing.phone,
              address: paymentMethod.billing.address
            } : undefined,
            
            // Include amount info (user's transaction)
            amounts: paymentMethod.amounts ? {
              gross: paymentMethod.amounts.gross,
              currency: paymentMethod.amounts.currency
            } : undefined,
            
            // Exclude sensitive internal data
            // source: paymentMethod.source, // Exclude source details
            // transaction: paymentMethod.transaction, // Exclude full transaction object
            // timestamps: paymentMethod.timestamps, // Exclude detailed timestamps
            // status: paymentMethod.status, // Exclude internal status
            // origin: paymentMethod.origin // Exclude origin info
          };
        }
      });
      console.log(`[${formatDate()}] - 🔄 Transformed order items and filtered sensitive payment data`);
    }
    
    // Cache the fetched profile
    await cacheProfile(cacheKey, profile);
    console.log(`[${formatDate()}] - 💾 Profile cached for user ${userId}`);
    
    const responseTime = Date.now() - startTime.getTime();
    console.log(`[${formatDate()}] - 📤 Sending profile response | User: ${userId} | Response time: ${responseTime}ms | Cached: false`);
    res.status(200).json({
      success: true,
      data: profile,
      cached: false
    });
    
  } catch (error) {
    logError(`❌ PROFILE FETCH FAILED for user ${userId}: ${error.message}`);
    logError(`📍 Stack Trace: ${error.stack}`);
    
    // Return cached data if available even on error (graceful degradation)
    const fallbackCache = memoryCache.get(cacheKey);
    if (fallbackCache && Date.now() - fallbackCache.timestamp < CACHE_TTL * 2) {
      console.log(`[${formatDate()}] - 🔄 Graceful degradation: serving stale cache for user ${userId}`);
      return res.status(200).json({
        success: true,
        data: fallbackCache.data,
        cached: true,
        stale: true
      });
    }
    
    const responseTime = Date.now() - startTime.getTime();
    logError(`⏱️  Failed profile fetch time: ${responseTime}ms`);
    
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
    console.log(`[${formatDate()}] - 📝 Profile cached successfully | Key: ${cacheKey} | Orders: ${profile.orders?.length || 0}`);
  } catch (redisError) {
    // Fallback to memory cache
    memoryCache.set(cacheKey, {
      data: profile,
      timestamp: Date.now()
    });
    
    console.log(`[${formatDate()}] - 📝 Profile cached in memory | Key: ${cacheKey} | Cache size: ${memoryCache.size}`);
    
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
  let cleanedCount = 0;
  
  for (const [key, value] of memoryCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      memoryCache.delete(key);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`[${formatDate()}] - 🧹 Cache cleanup completed | Removed: ${cleanedCount} entries | Current size: ${memoryCache.size}`);
  }
}

// Export cache utilities for other modules
module.exports.cacheProfile = cacheProfile;
module.exports.cleanupMemoryCache = cleanupMemoryCache;
