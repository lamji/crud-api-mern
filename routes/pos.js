const express = require('express');
const { protect } = require('../middleware/auth');
const {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus
} = require('../controllers/pos');
const { validateCreateOrder, validateUpdateOrderStatus } = require('../validators/posValidator');

// Middleware to check if user is admin (not cashier) - blocks cashiers only
const adminOnly = (req, res, next) => {
  if (req.user?.role === process.env.CASHIER_KEY) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Cashiers can only view orders.',
      statusCode: 403
    });
  }
  next();
};

// Middleware to check if user is admin or user (blocks cashiers, allows users and admins)
const allowUsersAndAdmins = (req, res, next) => {
  if (req.user?.role === process.env.CASHIER_KEY) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Cashiers cannot create orders.',
      statusCode: 403
    });
  }
  next();
};

const router = express.Router();

// Router for POS endpoints. Mounted at `/api/pos` in `server.js`.
// Notes on imports used here:
// - `Order` model: Mongoose schema for orders with items array
// - `protect` middleware: verifies `Authorization: Bearer <token>` and populates `req.user`

// @desc    Create new order
// @route   POST /pos/orders
// @access  Private (Admin and User only)
router.post('/orders', protect, allowUsersAndAdmins, validateCreateOrder, createOrder);

// @desc    Get all orders with pagination and filtering
// @route   GET /pos/orders
// @access  Private (Admin/Cashier only)
router.get('/orders', protect, getOrders);

// @desc    Get order by ID
// @route   GET /pos/orders/:orderId
// @access  Private (Admin only)
router.get('/orders/:orderId', protect, adminOnly, getOrderById);

// @desc    Update order status
// @route   PATCH /pos/orders/:orderId/status
// @route   PUT /pos/orders/:orderId/status
// @access  Private (Cashier only)
router.patch('/orders/:orderId/status', protect, validateUpdateOrderStatus, updateOrderStatus);
router.put('/orders/:orderId/status', protect, validateUpdateOrderStatus, updateOrderStatus);

module.exports = router;
