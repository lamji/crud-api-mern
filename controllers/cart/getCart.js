const Cart = require('../../models/Cart');


// Cache for in-memory storage (fallback when Redis unavailable)
const memoryCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * @desc    Get user's cart (optimized for high volume)
 * @route   GET /api/cart
 * @access  Private
 */
exports.getCart = async (req, res) => {
  const startTime = Date.now();
  const userId = req.user.id;
  const cacheKey = `cart:${userId}`;
  
  try {
    // Try cache first
    let cachedCart = null;
    
    // Fallback to memory cache
    if (memoryCache.has(cacheKey)) {
      const cached = memoryCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        cachedCart = cached.data;
      } else {
        memoryCache.delete(cacheKey);
      }
    }
    
    if (cachedCart) {
      console.log(`Cache hit for cart ${userId}, response time: ${Date.now() - startTime}ms`);
      
      // Add cart count and calculate totals
      const itemCount = cachedCart.items ? cachedCart.items.length : 0;
      const calculatedTotalAmount = cachedCart.items ? cachedCart.items.reduce((total, item) => {
        return total + (item.quantity * item.price);
      }, 0) : 0;
      
      // Add individual item totals to each cart item
      const itemsWithTotals = cachedCart.items ? cachedCart.items.map(item => ({
        ...item,
        itemTotal: item.quantity * item.price
      })) : [];
      
      const cartWithCount = {
        ...cachedCart,
        itemCount,
        totalCartAmount: calculatedTotalAmount,
        items: itemsWithTotals
      };
      
      return res.status(200).json({
        success: true,
        data: cartWithCount,
        cached: true,
        statusCode: 200
      });
    }
    
    // Cache miss - fetch from database with optimized query
    let cart = await Cart.findOne({ 
      user: userId 
    }).populate('items.product', '-__v')
      .select('-__v -updatedAt -_id -user')
      .lean(); // Return plain JavaScript object for better performance
    
    if (!cart) {
      // Create a default cart if it doesn't exist
      cart = await Cart.create({
        user: userId,
        items: [],
        totalAmount: 0
      });
      
      // Populate the newly created cart
      cart = await Cart.findById(cart._id)
        .populate('items.product', '-__v')
        .select('-__v -updatedAt -_id -user')
        .lean();
      
      // Cache the new cart
      await cacheCart(cacheKey, cart);
      
      console.log(`Created and cached new cart for user ${userId}, response time: ${Date.now() - startTime}ms`);
      
      // Add cart count and calculate totals
      const itemCount = cart.items ? cart.items.length : 0;
      const calculatedTotalAmount = cart.items ? cart.items.reduce((total, item) => {
        return total + (item.quantity * item.price);
      }, 0) : 0;
      
      // Add individual item totals to each cart item
      const itemsWithTotals = cart.items ? cart.items.map(item => ({
        ...item,
        itemTotal: item.quantity * item.price
      })) : [];
      
      const cartWithCount = {
        ...cart,
        itemCount,
        totalCartAmount: calculatedTotalAmount,
        items: itemsWithTotals
      };
      
      return res.status(200).json({
        success: true,
        data: cartWithCount,
        cached: false,
        statusCode: 200
      });
    }
    
    // Cache the fetched cart
    await cacheCart(cacheKey, cart);
    
    console.log(`Database hit for cart ${userId}, response time: ${Date.now() - startTime}ms`);
    
    // Add cart count and calculate totals
    const itemCount = cart.items ? cart.items.length : 0;
    const calculatedTotalAmount = cart.items ? cart.items.reduce((total, item) => {
      return total + (item.quantity * item.price);
    }, 0) : 0;
    
    // Add individual item totals to each cart item
    const itemsWithTotals = cart.items ? cart.items.map(item => ({
      ...item,
      itemTotal: item.quantity * item.price
    })) : [];
    
    const cartWithCount = {
      ...cart,
      itemCount,
      totalCartAmount: calculatedTotalAmount,
      items: itemsWithTotals
    };
    
    res.status(200).json({
      success: true,
      data: cartWithCount,
      cached: false,
      statusCode: 200
    });
    
  } catch (error) {
    console.error(`Error fetching cart for user ${userId}:`, error);
    
    // Return cached data if available even on error (graceful degradation)
    const fallbackCache = memoryCache.get(cacheKey);
    if (fallbackCache && Date.now() - fallbackCache.timestamp < CACHE_TTL * 2) {
      console.log(`Graceful degradation: serving stale cache for user ${userId}`);
      
      // Add cart count and calculate totals
      const itemCount = fallbackCache.data.items ? fallbackCache.data.items.length : 0;
      const calculatedTotalAmount = fallbackCache.data.items ? fallbackCache.data.items.reduce((total, item) => {
        return total + (item.quantity * item.price);
      }, 0) : 0;
      
      // Add individual item totals to each cart item
      const itemsWithTotals = fallbackCache.data.items ? fallbackCache.data.items.map(item => ({
        ...item,
        itemTotal: item.quantity * item.price
      })) : [];
      
      const cartWithCount = {
        ...fallbackCache.data,
        itemCount,
        totalCartAmount: calculatedTotalAmount,
        items: itemsWithTotals
      };
      
      return res.status(200).json({
        success: true,
        data: cartWithCount,
        cached: true,
        stale: true,
        statusCode: 200
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      requestId: req.id, // Add request ID for debugging
      statusCode: 500
    });
  }
};

/**
 * Helper function to cache cart data
 */
async function cacheCart(cacheKey, cart) {
  try {
    // Remove _id and user fields from cart before caching
    const { _id, user, ...cleanCart } = cart;
    
    // Fallback to memory cache
    memoryCache.set(cacheKey, {
      data: cleanCart,
      timestamp: Date.now()
    });
    
    // Clean up old cache entries periodically
    if (memoryCache.size > 1000) {
      cleanupMemoryCache();
    }
  } catch (error) {
    console.warn('Cache operation failed:', error);
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
module.exports.cacheCart = cacheCart;
module.exports.cleanupMemoryCache = cleanupMemoryCache;
