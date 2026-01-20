const { validationResult } = require('express-validator');
const User = require('../../models/User');

/**
 * Verify OTP for password reset
 * - Validates OTP format and email
 * - Checks OTP against stored value and expiry
 * - Returns success if OTP is valid
 */
async function resetPasswordVerify(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { otp, email } = req.body;

    // Find user by email with password reset OTP fields
    const user = await User.findOne({ 
      email: email.toLowerCase().trim(), 
      isActive: true 
    }).select('+passwordResetOtp +passwordResetOtpExpiry');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if OTP exists and is not expired
    if (!user.passwordResetOtp || !user.passwordResetOtpExpiry) {
      return res.status(400).json({
        success: false,
        message: 'No reset request found. Please request a new password reset.',
      });
    }

    // Check if OTP has expired
    if (Date.now() > user.passwordResetOtpExpiry) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new password reset.',
      });
    }

    // Verify OTP
    if (user.passwordResetOtp !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP. Please try again.',
      });
    }

    // OTP is valid - generate reset tokens and clear OTP
    const resetToken = require('crypto').randomBytes(32).toString('hex');
    const resetTempToken = require('crypto').randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

    // Clear OTP and set reset tokens
    user.passwordResetOtp = undefined;
    user.passwordResetOtpExpiry = undefined;
    user.passwordResetToken = resetToken;
    user.passwordResetTokenExpiry = resetTokenExpiry;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully. You can now reset your password.',
      resetToken, // For API calls
      resetTempToken, // For localStorage page access
      resetTokenExpiry
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { resetPasswordVerify };
