const BlacklistedToken = require('../../models/BlacklistedToken');
const { verifyToken } = require('../../utils/jwt');

/**
 * Logout user by blacklisting the current token
 * @route   POST /api/auth/logout
 * @access  Private
 */
const logout = async (req, res, next) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    
    // Decode token to get expiration time
    const decoded = verifyToken(token);
    
    // If token is already invalid/expired, verifyToken would have thrown an error
    // which is caught in the catch block
    
    // Create expiration date from token exp (in seconds)
    const expiresAt = new Date(decoded.exp * 1000);

    // Save token to blacklist
    await BlacklistedToken.create({
      token,
      expiresAt
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully. Token invalidated.'
    });
  } catch (error) {
    // If token verification fails, the user is already practically logged out
    res.status(200).json({
      success: true,
      message: 'Logged out successfully.'
    });
  }
};

module.exports = {
  logout
};
