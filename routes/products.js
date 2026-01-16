const express = require('express');
const { protect } = require('../middleware/auth');
const {
  bulkUploadProducts,
  getAllProducts,
  getProductById,
  clearProductCache
} = require('../controllers/product');
const { validateBulkUpload } = require('../validators/productValidator');

// Middleware to check if user is admin (using ADMIN_KEY from environment)
const adminOnly = (req, res, next) => {
  if (req.user?.role !== process.env.ADMIN_KEY) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin access required.',
      statusCode: 403
    });
  }
  next();
};

const router = express.Router();
// Notes on imports used here:
// - `express-validator`: declaratively validates request bodies (returns 400 on invalid input)
// - `Product` model: Mongoose schema with full product data structure
// - `protect` middleware: verifies `Authorization: Bearer <token>` and populates `req.user`

// @desc    Bulk upload products
// @route   POST /products/bulk-upload
// @access  Private (Admin only)
router.post('/bulk-upload', protect, adminOnly, validateBulkUpload, bulkUploadProducts);

// @desc    Get all products with pagination and filtering
// @route   GET /products
// @access  Public
router.get('/', getAllProducts);

// @desc    Get product by ID
// @route   GET /products/:id
// @access  Public
router.get('/:id', getProductById);

// @desc    Clear product cache (Admin only)
// @route   POST /products/clear-cache
// @access  Private (Admin only)
router.post('/clear-cache', protect, adminOnly, clearProductCache);

module.exports = router;
