const express = require('express');
const { protect } = require('../middleware/auth');
const {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus
} = require('../controllers/pos');
const { validateCreateOrder, validateUpdateOrderStatus } = require('../validators/posValidator');

// Import test order controller
const { testCreateOrder, getTestOrder } = require('../controllers/pos/testOrderController');

// Middleware to check if user is admin (not cashier) - blocks cashiers only
const adminOnly = (req, res, next) => {
  if (req.user?.role === process.env.CASHIER_KEY) {
    return res.status(403).json({
      success: false,
      message: 'Access denied ',
      statusCode: 403
    });
  }
  next();
};

// Middleware to check if user is user only (blocks cashiers and admins)
const userOnly = (req, res, next) => {
  console.log('🔍 DEBUG: User role check for /test-create-order');
  console.log('📋 User object:', JSON.stringify(req.user, null, 2));
  console.log('🎯 User role:', req.user?.role);
  console.log('🔑 CASHIER_KEY from env:', process.env.CASHIER_KEY);
  console.log('🔑 ADMIN_KEY from env:', process.env.ADMIN_KEY);
  
  if (req.user?.role === process.env.CASHIER_KEY) {
    console.log('❌ Blocking cashier access');
    return res.status(403).json({
      success: false,
      message: 'Access denied',
      statusCode: 403
    });
  }
  if (req.user?.role === process.env.ADMIN_KEY) {
    console.log('❌ Blocking admin access');
    return res.status(403).json({
      success: false,
      message: 'Access denied',
      statusCode: 403
    });
  }
  console.log('✅ Allowing user access');
  // Only allow users (no role specified or different from cashier/admin)
  next();
};

// Middleware to check if user is cashier only
const cashierOnly = (req, res, next) => {
  if (req.user?.role !== 'cashier') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Cashier only endpoint.',
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
      message: 'Access denied',
      statusCode: 403
    });
  }
  next();
};

const router = express.Router();

// Test endpoints (user-only access)
router.post('/test-create-order', protect, userOnly, testCreateOrder);
router.get('/test-order/:orderId', getTestOrder);

// Logout endpoint (cashier only)
router.post('/logout', protect, cashierOnly, async (req, res) => {
  try {
    // Clear the cookie if using cookies
    res.clearCookie('token');
    
    // Clear cashier active session
    const Cashier = require('../models/Cashier');
    const cashier = await Cashier.findById(req.user._id);
    
    if (cashier) {
      // Clear cashier active session
      await cashier.recordLogout(
        req.ip || req.connection.remoteAddress,
        req.get('User-Agent')
      );
      console.log('🚪 Cashier logged out and session cleared:', req.user?.userName);
    }
    
    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
      statusCode: 200
    });
  } catch (error) {
    console.error('❌ Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed',
      statusCode: 500
    });
  }
});

// Manual logout endpoint for admin (logout cashier by username)
router.post('/force-logout', protect, async (req, res) => {
  try {
    const { userName } = req.body;
    
    if (!userName) {
      return res.status(400).json({
        success: false,
        message: 'Username is required',
        statusCode: 400
      });
    }
    
    console.log('🔑 Admin force logout request for cashier:', userName);
    console.log('👤 Requested by:', req.user?.email || req.user?.userName);
    
    const Cashier = require('../models/Cashier');
    const cashier = await Cashier.findOne({ userName, isActive: true });
    
    if (!cashier) {
      return res.status(404).json({
        success: false,
        message: 'Cashier not found',
        statusCode: 404
      });
    }
    
    // Check if cashier has active session
    if (!cashier.hasActiveSession()) {
      return res.status(400).json({
        success: false,
        message: 'Cashier is not currently logged in',
        statusCode: 400
      });
    }
    
    // Force logout the cashier
    await cashier.recordLogout(
      req.ip || req.connection.remoteAddress,
      req.get('User-Agent')
    );
    
    console.log('🚪 Force logout completed for cashier:', userName);
    
    res.status(200).json({
      success: true,
      message: `Cashier ${userName} has been forcefully logged out`,
      statusCode: 200,
      data: {
        cashierName: cashier.name,
        userName: cashier.userName,
        previousSession: {
          ipAddress: cashier.sessionInfo?.ipAddress,
          loginTime: cashier.sessionInfo?.loginTime
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Force logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Force logout failed',
      statusCode: 500
    });
  }
});

// Protected endpoints
router.use(protect); // All routes below this require authentication

router.post('/orders', allowUsersAndAdmins, validateCreateOrder, createOrder);
router.get('/orders', getOrders);
router.get('/orders/:orderId', adminOnly, getOrderById);
router.patch('/orders/:orderId/status', validateUpdateOrderStatus, updateOrderStatus);
router.put('/orders/:orderId/status', validateUpdateOrderStatus, updateOrderStatus);

module.exports = router;
