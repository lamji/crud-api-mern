const Profile = require('../../models/Profile');

/**
 * @desc    Reset OTP lock for user (admin/utility function)
 * @route   POST /api/profile/reset-otp-lock
 * @access  Private
 */
exports.resetOtpLock = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Clear OTP lock and attempts
    await Profile.findOneAndUpdate(
      { userId: userId },
      { 
        $unset: {
          otpLockedUntil: 1,
          otpAttempts: 1,
          emailVerificationOtp: 1,
          emailVerificationOtpExpiry: 1
        }
      }
    );

    res.status(200).json({
      success: true,
      message: 'OTP lock and attempts cleared successfully'
    });
  } catch (error) {
    console.error('Error resetting OTP lock:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
