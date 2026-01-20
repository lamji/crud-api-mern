const { validationResult } = require('express-validator');
const User = require('../../models/User');

/**
 * Reset user password
 * - Validates email and new password
 * - Updates password in database
 * - Returns success response
 */
async function resetPassword(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { email, password, token } = req.body;

    // Find user by email with reset token fields
    const user = await User.findOne({ 
      email: email.toLowerCase().trim(), 
      isActive: true 
    }).select('+passwordResetToken +passwordResetTokenExpiry');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if reset token exists and is not expired
    if (!user.passwordResetToken || !user.passwordResetTokenExpiry) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token. Please request a new password reset.',
      });
    }

    // Check if reset token has expired
    if (Date.now() > user.passwordResetTokenExpiry) {
      return res.status(400).json({
        success: false,
        message: 'Reset token has expired. Please request a new password reset.',
      });
    }

    // Verify reset token
    if (user.passwordResetToken !== token) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reset token. Please request a new password reset.',
      });
    }

    // Token is valid - update password and clear token
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetTokenExpiry = undefined;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { resetPassword };
