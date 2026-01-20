const Cashier = require('../../models/Cashier');

/**
 * Handle cashier logout
 * - Validates cashier role
 * - Clears active session
 * - Returns success response
 */
async function cashierLogout(req, res, next) {
  try {
    // Check if user is a cashier
    if (req.user?.role !== process.env.CASHIER_KEY) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Cashier logout only.',
        statusCode: 403
      });
    }

    // Find cashier and clear session
    const cashier = await Cashier.findById(req.user.id);
    
    if (!cashier) {
      return res.status(404).json({
        success: false,
        message: 'Cashier not found',
        statusCode: 404
      });
    }

    // Record logout to clear active session
    await cashier.recordLogout(req.ip, req.get('User-Agent'));

    res.status(200).json({
      success: true,
      message: 'Cashier logged out successfully',
      statusCode: 200
    });

  } catch (error) {
    console.error('Cashier logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      statusCode: 500
    });
  }
}

module.exports = { cashierLogout };
