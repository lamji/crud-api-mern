/**
 * POS Middleware Utilities
 * Contains role-based access control middleware for POS routes
 */

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

module.exports = {
  adminOnly,
  userOnly,
  cashierOnly,
  allowUsersAndAdmins
};
