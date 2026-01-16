// Cache for in-memory storage (fallback when Redis unavailable)
const memoryCache = new Map();

/**
 * @desc    Clear product cache
 * @route   POST /api/products/clear-cache
 * @access  Private (Admin only)
 */
exports.clearProductCache = async (req, res) => {
  try {
    // Clear all product-related cache entries
    const cacheKeys = Array.from(memoryCache.keys()).filter(key => 
      key.startsWith('products:') || 
      key.startsWith('product:') || 
      key.startsWith('product-list:')
    );
    
    cacheKeys.forEach(key => memoryCache.delete(key));
    
    console.log(`Cleared ${cacheKeys.length} product cache entries`);
    
    res.status(200).json({
      success: true,
      message: 'Product cache cleared successfully',
      clearedEntries: cacheKeys.length
    });
    
  } catch (error) {
    console.error('Error clearing product cache:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      requestId: req.id
    });
  }
};
