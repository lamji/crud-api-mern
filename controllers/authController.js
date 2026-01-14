const { validationResult } = require('express-validator');
const User = require('../models/User');
const { generateToken } = require('../utils/jwt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { register, logout } = require('./auth');

/**
 * Handle user login
 * - Validates request
 * - Verifies credentials with User.findByCredentials
 * - Updates lastLogin atomically for concurrency safety
 * - Returns JWT and user info
 * - Optimized for high-volume requests
 */
async function login(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { email, password } = req.body;

    try {
      // Find user and verify credentials
      const user = await User.findByCredentials(email, password);

      // Update lastLogin atomically for concurrency safety
      await User.findByIdAndUpdate(
        user._id,
        { $set: { lastLogin: new Date() } },
        { new: true }
      );

      // Fetch user with signupPlatform and oneSignalUserId
      const userWithPlatform = await User.findById(user._id)
        .select('+signupPlatform +oneSignalUserId');

      const token = generateToken({ 
        id: user._id,
        role: user.role 
      });

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        token,
        user: {
          name: user.name,
          email: user.email,
          role: user.role,
          lastLogin: new Date(),
          createdAt: user.createdAt,
          signupPlatform: userWithPlatform?.signupPlatform || 'web',
          oneSignalUserId: userWithPlatform?.oneSignalUserId,
        },
      });
    } catch (err) {
      // Keep original error handling behavior
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }
  } catch (error) {
    return next(error);
  }
}





/**
 * Handle guest login
 * - Uses environment variables for guest credentials
 * - Returns JWT and user info
 * - Optimized for high-volume guest access
 */
async function guestLogin(req, res, next) {
  try {
    const guestEmail = process.env.GUEST_EMAIL;
    const guestPassword = process.env.GUEST_PASSWORD;

    if (!guestEmail || !guestPassword) {
      return res.status(500).json({
        success: false,
        message: 'Guest credentials not configured',
      });
    }

    // Use lean query for better performance
    let user = await User.findOne({ email: guestEmail }).lean();
    
    if (!user) {
      // Create guest user if doesn't exist
      user = await User.create({
        name: 'Guest User',
        email: guestEmail,
        password: guestPassword,
        role: 'guest'
      });
    } else {
      // Verify password if user exists
      try {
        user = await User.findByCredentials(guestEmail, guestPassword);
      } catch (err) {
        return res.status(401).json({
          success: false,
          message: 'Guest credentials are invalid',
        });
      }
    }

    // Update lastLogin atomically
    await User.findByIdAndUpdate(
      user._id,
      { $set: { lastLogin: new Date() } }
    );

    const token = generateToken({ 
      id: user._id,
      role: user.role 
    });

    return res.status(200).json({
      success: true,
      message: 'Guest login successful',
      token,
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
        lastLogin: new Date(),
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Check if email exists and send OTP for password reset
 * - Validates email format
 * - If email exists, generates and sends OTP
 * - Returns whether email exists and OTP status
 */
async function checkEmail(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { email } = req.body;

    // Use lean query for better performance - only check existence
    const user = await User.findOne({ 
      email: email.toLowerCase().trim(), 
      isActive: true 
    }).select('email name');

    const exists = !!user;

    if (!exists) {
      return res.status(200).json({
        success: true,
        message: 'Email not found',
        exists: false,
        email: null,
      });
    }

    // Email exists, generate and send OTP
    try {
      // Generate unique OTP using timestamp + random (same as registration)
      const timestamp = Date.now().toString().slice(-3);
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      const otp = timestamp + random;
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

      // Store OTP in user document (add these fields to User schema if needed)
      await User.findOneAndUpdate(
        { email: email.toLowerCase().trim() },
        { 
          $set: { 
            passwordResetOtp: otp,
            passwordResetOtpExpiry: otpExpiry
          }
        }
      );

      // Send email using Nodemailer (same logic as registration)
      if (!process.env.EMAIL_SERVICE || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('Email service not configured. Please set EMAIL_SERVICE, EMAIL_USER, and EMAIL_PASS environment variables.');
        
        return res.status(200).json({
          success: true,
          message: 'Password reset code generated (email service not configured)',
          exists: true,
          email: user.email,
          // In development, include OTP for testing
          ...(process.env.NODE_ENV === 'development' && { otp })
        });
      }

      const nodemailer = require('nodemailer');
      
      // Create transporter based on service
      let transporter;
      
      if (process.env.EMAIL_SERVICE === 'gmail') {
        transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          }
        });
      } else if (process.env.EMAIL_SERVICE === 'ethereal') {
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass
          }
        });
      } else if (process.env.EMAIL_SERVICE === 'namecheap') {
        transporter = nodemailer.createTransport({
          host: 'mail.privateemail.com',
          port: 587,
          secure: false,
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          }
        });
      } else {
        transporter = nodemailer.createTransport({
          host: process.env.EMAIL_HOST,
          port: process.env.EMAIL_PORT || 587,
          secure: process.env.EMAIL_SECURE === 'true',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          }
        });
      }

      const emailContent = {
        from: `"HotShop" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
        to: user.email,
        subject: 'Reset Your Password',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Password Reset</h2>
            <p>Hi ${user.name || 'User'},</p>
            <p>We received a request to reset your password. Your verification code is:</p>
            <div style="background: #f0f0f0; padding: 20px; text-align: center; margin: 20px 0;">
              <span style="font-size: 24px; font-weight: bold; letter-spacing: 3px; color: #333;">${otp}</span>
            </div>
            <p>This code will expire in 10 minutes.</p>
            <p>If you didn't request this code, please ignore this email.</p>
            <hr style="border: 1px solid #eee; margin: 30px 0;">
            <p style="color: #666; font-size: 12px;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        `
      };

      const result = await transporter.sendMail(emailContent);
    
      // If using Ethereal, show preview URL
      if (process.env.EMAIL_SERVICE === 'ethereal' && result.messageId) {
        console.log('Preview URL:', nodemailer.getTestMessageUrl(result));
      }

      console.log(`Password reset OTP was successfully sent to ${user.email}`);

    } catch (emailError) {
      console.error('Error sending password reset email:', emailError);
      
      return res.status(500).json({
        success: false,
        message: 'Failed to send reset code. Please try again later.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Password reset code sent to your email',
      exists: true,
      email: user.email,
    });
  } catch (error) {
    return next(error);
  }
}

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

module.exports = {
  register,
  login,
  guestLogin,
  logout,
  checkEmail,
  resetPassword,
  resetPasswordVerify,
};
