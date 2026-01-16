const express = require('express');
const { protect } = require('../middleware/auth');
const {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart
} = require('../controllers/cart');
const { validateAddToCart, validateUpdateCartItem } = require('../validators/cartValidator');

// Middleware to check if user is admin (not cashier)
const adminOnly = (req, res, next) => {
  if (req.user?.role === process.env.CASHIER_KEY) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Cashiers cannot access cart endpoints.',
      statusCode: 403
    });
  }
  next();
};

const router = express.Router();

// Router for cart endpoints. Mounted at `/api/cart` in `server.js`.
// Notes on imports used here:
// - `express-validator`: declaratively validates request bodies (returns 400 on invalid input)
// - `Cart` model: Mongoose schema with user association and items array
// - `protect` middleware: verifies `Authorization: Bearer <token>` and populates `req.user`

// @desc    Get user's cart
// @route   GET /cart
// @access  Private (Admin only)
router.get('/', protect, adminOnly, getCart);

// @desc    Add item to cart
// @route   POST /cart/add
// @access  Private (Admin only)
router.post('/add', protect, adminOnly, validateAddToCart, addToCart);

// @desc    Update cart item quantity
// @route   PUT /cart/update/:itemId
// @access  Private (Admin only)
router.put('/update/:itemId', protect, adminOnly, validateUpdateCartItem, updateCartItem);

// @desc    Remove item from cart
// @route   DELETE /cart/remove/:itemId
// @access  Private (Admin only)
router.delete('/remove/:itemId', protect, adminOnly, removeFromCart);

module.exports = router;
