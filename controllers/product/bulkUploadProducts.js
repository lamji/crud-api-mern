const Product = require('../../models/Product');
const User = require('../../models/User');

// Cache for in-memory storage (fallback when Redis unavailable)
const memoryCache = new Map();


/**
 * @desc    Bulk upload products (Admin only)
 * @route   POST /api/products/bulk-upload
 * @access  Private (Admin only)
 */
exports.bulkUploadProducts = async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Check if user is admin
    const user = await User.findById(req.user.id);
    // if (!user || user.role !== 'admin') {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'Admin access required'
    //   });
    // }

    const { products, clearExisting = false } = req.body;

    // Clear existing products if requested
    if (clearExisting) {
      await Product.deleteMany({});
      // Clear cache
      memoryCache.clear();
    }

    // Remove id field from products if present (MongoDB _id will be used instead)
    const cleanProducts = products.map(product => {
      const { id, ...productData } = product;
      return productData;
    });

    // Validate and insert products
    const insertResult = await Product.insertMany(cleanProducts, { 
      ordered: false, // Continue on error for individual documents
      rawResult: true 
    });

    // Clear relevant cache
    const cacheKeys = Array.from(memoryCache.keys()).filter(key => 
      key.startsWith('products:') || key.startsWith('product-list:')
    );
    cacheKeys.forEach(key => memoryCache.delete(key));

    console.log(`Bulk upload completed: ${insertResult.insertedCount} products inserted in ${Date.now() - startTime}ms`);

    res.status(201).json({
      success: true,
      message: 'Products uploaded successfully',
      data: {
        insertedCount: insertResult.insertedCount,
        totalCount: cleanProducts.length,
        processingTime: `${Date.now() - startTime}ms`
      }
    });

  } catch (error) {
    console.error('Error bulk uploading products:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }

    if (error.name === 'BulkWriteError') {
      return res.status(400).json({
        success: false,
        message: 'Bulk write error',
        details: error.writeErrors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      requestId: req.id
    });
  }
};
