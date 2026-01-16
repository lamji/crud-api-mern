const Product = require('../models/Product');

/**
 * @desc    Bulk upload products
 * @route   POST /api/products/bulk-upload
 * @access  Private (Admin only)
 */
exports.bulkUploadProducts = async (req, res) => {
  try {
    const { products } = req.body;

    if (!products || !Array.isArray(products)) {
      return res.status(400).json({
        success: false,
        message: 'Products array is required'
      });
    }

    if (products.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Products array cannot be empty'
      });
    }

    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    // Clear existing products (optional - remove if you want to append instead)
    await Product.deleteMany({});

    // Bulk insert products
    const insertedProducts = await Product.insertMany(products, { 
      ordered: true,
      rawResult: true 
    });

    res.status(201).json({
      success: true,
      message: `Successfully uploaded ${insertedProducts.insertedCount} products`,
      data: {
        insertedCount: insertedProducts.insertedCount,
        products: products.map(p => ({ id: p.id, title: p.title }))
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

/**
 * @desc    Get all products
 * @route   GET /api/products
 * @access  Public
 */
exports.getAllProducts = async (req, res) => {
  try {
    const { page = 1, limit = 20, category, type, minPrice, maxPrice } = req.query;

    // Build query
    const query = {};
    
    if (category) query.category = category;
    if (type) query.type = type;
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    const products = await Product.find(query)
      .select('-__v -updatedAt')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Product.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        products,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
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
 * @desc    Get product by ID
 * @route   GET /api/products/:id
 * @access  Public
 */
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findOne({ id })
      .select('-__v -updatedAt');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      data: product
    });

  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      requestId: req.id
    });
  }
};
