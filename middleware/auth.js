const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');
const Cashier = require('../models/Cashier');
const BlacklistedToken = require('../models/BlacklistedToken');

const protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Make sure token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    // Check if token is blacklisted
    const isBlacklisted = await BlacklistedToken.findOne({ token });
    if (isBlacklisted) {
      return res.status(401).json({
        success: false,
        message: 'Token has been invalidated. Please login again.'
      });
    }

    try {
      // Verify token
      const decoded = verifyToken(token);

      // Get user from token - check both User and Cashier models
      let user = null;
      
      if (decoded.type === 'cashier') {
        // Look for cashier in Cashier model
        user = await Cashier.findById(decoded.id);
      } else {
        // Look for regular user in User model
        user = await User.findById(decoded.id);
      }

      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'User not found or inactive'
        });
      }

      // Attach user and role to request
      req.user = user;
      req.user.role = decoded.role; // Ensure role comes from token
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }
  } catch (error) {
    next(error);
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`
      });
    }
    next();
  };
};

module.exports = {
  protect,
  authorize
};
