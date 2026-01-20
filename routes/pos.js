const express = require('express');
const { protect } = require('../middleware/auth');
const {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus
} = require('../controllers/pos');
const { validateCreateOrder, validateUpdateOrderStatus } = require('../validators/posValidator');
const { posLogout, posForceLogout } = require('../controllers/pos/posAuthController');
const { adminOnly, userOnly, cashierOnly, allowUsersAndAdmins } = require('../utils/roleValidator');

// Import test order controller
const { testCreateOrder, getTestOrder } = require('../controllers/pos/testOrderController');

const router = express.Router();

// Test endpoints (user-only access)
// @desc    Create test order (user only)
// @route   POST /pos/test-create-order
// @access  Private (User only)
router.post('/test-create-order', protect, userOnly, testCreateOrder);

// @desc    Get test order by ID
// @route   GET /pos/test-order/:orderId
// @access  Public
router.get('/test-order/:orderId', getTestOrder);

// @desc    POS Logout - Cashier self logout
// @route   POST /pos/logout
// @access  Private (Cashier only)
router.post('/logout', protect, cashierOnly, posLogout);

// @desc    POS Force Logout - Admin force logout cashier by username
// @route   POST /pos/force-logout
// @access  Private (Admin only)
router.post('/force-logout', protect, posForceLogout);

// Protected endpoints
router.use(protect); // All routes below this require authentication

// @desc    Create new order
// @route   POST /pos/orders
// @access  Private (Users and Admins only)
router.post('/orders', allowUsersAndAdmins, validateCreateOrder, createOrder);

// @desc    Get all orders
// @route   GET /pos/orders
// @access  Private
router.get('/orders', getOrders);

// @desc    Get order by ID
// @route   GET /pos/orders/:orderId
// @access  Private (Admin only)
router.get('/orders/:orderId', adminOnly, getOrderById);

// @desc    Update order status (PATCH)
// @route   PATCH /pos/orders/:orderId/status
// @access  Private
router.patch('/orders/:orderId/status', validateUpdateOrderStatus, updateOrderStatus);

// @desc    Update order status (PUT)
// @route   PUT /pos/orders/:orderId/status
// @access  Private
router.put('/orders/:orderId/status', validateUpdateOrderStatus, updateOrderStatus);

module.exports = router;
