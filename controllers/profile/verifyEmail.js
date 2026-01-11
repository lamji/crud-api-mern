const { validationResult } = require('express-validator');
const Profile = require('../../models/Profile');
const User = require('../../models/User');
const { generateToken } = require('../../utils/jwt');

/**
 * @desc    Verify email with OTP
 * @route   POST /api/profile/verify-email
 * @access  Private
 */
exports.verifyEmail = async (req, res) => {
  try {
    const { otp } = req.body;

    if (!otp || typeof otp !== 'string' || otp.trim().length !== 6) {
      return res.status(400).json({
        success: false,
        message: 'Valid 6-digit OTP is required'
      });
    }

    // First check if this is a registration verification (no auth required for registration)
    // Check if there's a pending registration with this OTP
    if (global.pendingRegistrations) {
      for (const [email, pendingReg] of Object.entries(global.pendingRegistrations)) {
        if (pendingReg.emailVerificationOtp === otp.trim() && 
            new Date() <= pendingReg.emailVerificationOtpExpiry) {
          
          // This is a valid registration OTP - create the user account
          try {
            const user = await User.create({
              name: pendingReg.name,
              email: pendingReg.email,
              password: pendingReg.password,
              isEmailVerified: true,
              emailVerifiedAt: new Date()
            });

            // Clean up pending registration
            delete global.pendingRegistrations[email];

            // Generate JWT token with role included
            const token = generateToken({ 
              id: user._id,
              role: user.role 
            });

            return res.status(201).json({
              success: true,
              message: 'Registration completed successfully',
              token,
              user: {
                name: user.name,
                email: user.email,
                role: user.role,
                isEmailVerified: user.isEmailVerified,
                emailVerifiedAt: user.emailVerifiedAt,
                createdAt: user.createdAt
              },
            });
          } catch (createError) {
            console.error('Error creating user during registration verification:', createError);
            return res.status(500).json({
              success: false,
              message: 'Failed to complete registration. Please try again.'
            });
          }
        }
      }
    }

    // If not a registration verification, proceed with profile email verification
    let profile = await Profile.findOne({ userId: req.user.id }).lean();
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    // Check if OTP exists and is not expired
    if (!profile.emailVerificationOtp || !profile.emailVerificationOtpExpiry) {
      return res.status(400).json({
        success: false,
        message: 'No verification code found. Please request a new one.'
      });
    }

    if (new Date() > profile.emailVerificationOtpExpiry) {
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please request a new one.'
      });
    }

    // Rate limiting: Check for too many failed attempts
    if (profile.otpAttempts && profile.otpAttempts >= 5) {
      // Check if lock has expired
      if (profile.otpLockedUntil && new Date() < profile.otpLockedUntil) {
        const remainingTime = Math.ceil((profile.otpLockedUntil - new Date()) / 1000);
        console.log(`Account locked. Remaining time: ${remainingTime} seconds`);
        
        return res.status(429).json({
          success: false,
          message: `Too many failed attempts. Account locked. Try again in ${remainingTime} seconds.`
        });
      }
      
      // Lock has expired, reset attempts and continue
      if (profile.otpLockedUntil && new Date() >= profile.otpLockedUntil) {
        console.log('Lock expired, resetting attempts');
        await Profile.findOneAndUpdate(
          { userId: req.user.id },
          { 
            $unset: {
              otpLockedUntil: 1,
              otpAttempts: 1
            }
          }
        );
        
        // Refresh profile data after reset
        profile = await Profile.findOne({ userId: req.user.id }).lean();
      } else {
        // Set new lock for 1 minute
        const lockUntil = new Date(Date.now() + 1 * 60 * 1000);
        await Profile.findOneAndUpdate(
          { userId: req.user.id },
          { $set: { otpLockedUntil: lockUntil } }
        );
        
        return res.status(429).json({
          success: false,
          message: 'Too many failed attempts. Account locked for 1 minute.'
        });
      }
    }

    if (profile.emailVerificationOtp !== otp.trim()) {
      // Increment failed attempts
      const attempts = (profile.otpAttempts || 0) + 1;
      await Profile.findOneAndUpdate(
        { userId: req.user.id },
        { $set: { otpAttempts: attempts } }
      );

      const remainingAttempts = 5 - attempts;
      return res.status(400).json({
        success: false,
        message: `Invalid verification code. ${remainingAttempts} attempts remaining.`
      });
    }

    // Determine if this is for email update or general verification
    const updateData = {
      emailVerified: true,
      $unset: {
        emailVerificationOtp: 1,
        emailVerificationOtpExpiry: 1,
        otpAttempts: 1,
        otpLockedUntil: 1
      }
    };

    // If there's a pending email, update the email
    if (profile.pendingEmail) {
      updateData.$set = { email: profile.pendingEmail };
      updateData.$unset.pendingEmail = 1;
    }

    // Mark email as verified and clear OTP
    const updatedProfile = await Profile.findOneAndUpdate(
      { userId: req.user.id },
      updateData,
      { new: true }
    ).select('-__v -updatedAt -_id -userId'); // Exclude ID fields

    const message = profile.pendingEmail 
      ? 'Email updated and verified successfully'
      : 'Email verified successfully';

    res.status(200).json({
      success: true,
      message,
      data: updatedProfile
    });
  } catch (error) {
    console.error('Error verifying email:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
