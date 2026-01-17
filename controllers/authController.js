const { validationResult } = require('express-validator');
const User = require('../models/User');
const Cashier = require('../models/Cashier');
const { generateToken } = require('../utils/jwt');
const { formatDate, logError } = require('../utils/logging');
const { getJSON, setJSON } = require('../utils/redis');
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
  const startTime = Date.now();
  const startTimeFormatted = formatDate(startTime);
  const { email, password } = req.body;
  let usedRedis = true; // Track if Redis was used
  console.log(`\n[${startTimeFormatted}] - 🔐 LOGIN PROCESS STARTED | Email: ${email} | IP: ${req.ip}`);

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log(`[${startTimeFormatted}] - ❌ Validation failed | Email: "${email}" | Password: "${password ? '[REDACTED]' : 'EMPTY'}" | Errors:`, errors.array());
      logError('❌ Validation failed');
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    console.log(`[${startTimeFormatted}] - 🔍 Parallel login check for: ${email}`);

    // Check Redis cache first for user data
    const userCacheKey = `user:${email.toLowerCase()}`;
    const cachedUser = await getJSON(userCacheKey);
    
    if (cachedUser) {
      console.log(`[${startTimeFormatted}] - 🎯 Redis cache HIT for user: ${email}`);
      usedRedis = true;
      // Verify cached user password
      try {
        const User = require('../models/User');
        const tempUser = new User(cachedUser);
        const isMatch = await tempUser.matchPassword(password);
        
        if (isMatch) {
          console.log(`[${startTimeFormatted}] - ✅ Cached user credentials verified: ${cachedUser.name}`);
          
          const token = generateToken({ id: cachedUser._id, role: cachedUser.role });
          const userData = {
            name: cachedUser.name,
            email: cachedUser.email,
            role: cachedUser.role,
            lastLogin: new Date(),
            createdAt: cachedUser.createdAt,
            signupPlatform: cachedUser.signupPlatform || 'web',
          };
          
          const responseTime = Date.now() - startTime;
          console.log(`[${startTimeFormatted}] - ✅ CACHED USER LOGIN SUCCESSFUL | Total time: ${responseTime}ms | Redis: ${usedRedis}`);
          return res.status(200).json({ success: true, message: 'Login successful', token, user: userData });
        }
      } catch (passwordError) {
        console.log(`[${startTimeFormatted}] - ⚠️ Cached user password verification failed, falling back to DB`);
        usedRedis = false;
      }
    } else {
      console.log(`[${startTimeFormatted}] - 🗄️ Redis cache MISS for user: ${email}`);
      usedRedis = false;
    }

    const [userResult, cashierResult] = await Promise.allSettled([
      User.findByCredentials(email, password),
      Cashier.findByCredentials(email, password)
    ]);

    // --- User Login Success --- 
    if (userResult.status === 'fulfilled') {
      const user = userResult.value;
      console.log(`[${startTimeFormatted}] - ✅ User credentials verified: ${user.name}`);

      const userWithPlatform = await User.findByIdAndUpdate(
        user._id,
        { $set: { lastLogin: new Date() } },
        { new: true, select: '+signupPlatform +createdAtKey', lean: true }
      );

      // Cache user data in Redis for 5 minutes (300 seconds)
      const userToCache = {
        ...user,
        signupPlatform: userWithPlatform?.signupPlatform || 'web',
        createdAtKey: userWithPlatform?.createdAtKey
      };
      await setJSON(userCacheKey, userToCache, 300);
      console.log(`[${startTimeFormatted}] - 💾 User data cached in Redis for 5 minutes`);

      const userData = {
        name: user.name,
        email: user.email,
        role: user.role,
        lastLogin: new Date(),
        createdAt: user.createdAt,
        signupPlatform: userWithPlatform?.signupPlatform || 'web',
      };

      const token = generateToken({ id: user._id, role: user.role });
      const responseTime = Date.now() - startTime;
      console.log(`[${startTimeFormatted}] - ✅ USER LOGIN SUCCESSFUL | Total time: ${responseTime}ms | Redis: ${usedRedis}`);
      
      return res.status(200).json({ success: true, message: 'Login successful', token, user: userData });
    }

    // --- Cashier Login Success ---
    if (cashierResult.status === 'fulfilled') {
      const cashier = cashierResult.value;
      console.log(`[${startTimeFormatted}] - ✅ Cashier credentials verified: ${cashier.name}`);

      if (cashier.hasActiveSession()) {
        logError('🚫 Cashier login blocked - active session exists');
        return res.status(403).json({
          success: false,
          message: 'Cashier already logged in from another device. Please logout first.',
          activeSession: cashier.sessionInfo
        });
      }

      await cashier.recordLogin(req.ip, req.get('User-Agent'));
      const userData = {
        name: cashier.name,
        userName: cashier.userName,
        role: process.env.CASHIER_KEY || 'cashier',
        lastLogin: cashier.lastLogin,
      };

      const token = generateToken({ id: cashier._id, role: process.env.CASHIER_KEY || 'cashier', type: 'cashier' });
      const responseTime = Date.now() - startTime;
      console.log(`[${startTimeFormatted}] - ✅ CASHIER LOGIN SUCCESSFUL | Total time: ${responseTime}ms | Redis: ${usedRedis}`);

      return res.status(200).json({ success: true, message: 'Login successful', token, user: userData });
    }

    // --- Login Failure ---
    logError('❌ LOGIN FAILED - Invalid credentials');
    const userErrorReason = userResult.reason?.message || 'N/A';
    const cashierErrorReason = cashierResult.reason?.message || 'N/A';
    console.log(`[${startTimeFormatted}] - User Auth Failure: ${userErrorReason}`);
    console.log(`[${startTimeFormatted}] - Cashier Auth Failure: ${cashierErrorReason}`);
    logError(`⏱️  Failed login time: ${Date.now() - startTime}ms`);

    return res.status(401).json({ success: false, message: 'Invalid credentials' });

  } catch (error) {
    logError('💥 LOGIN ERROR - Server error');
    logError(`📝 Error: ${error.message}`);
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
  const startTime = Date.now();
  const startTimeFormatted = formatDate(startTime);
  const { email } = req.body;
  let usedRedis = false;
  console.log(`\n[${startTimeFormatted}] - 📧 EMAIL CHECK PROCESS STARTED | Email: ${email} | IP: ${req.ip}`);

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    // Check Redis cache first for email existence
    const emailCacheKey = `email_exists:${email.toLowerCase()}`;
    const cachedEmailExists = await getJSON(emailCacheKey);
    
    if (cachedEmailExists !== null) {
      console.log(`[${startTimeFormatted}] - 🎯 Redis cache HIT for email check: ${email}`);
      usedRedis = true;
      if (!cachedEmailExists) {
        return res.status(200).json({
          success: true,
          message: 'Email not found',
          exists: false,
          email: null,
        });
      }
    } else {
      console.log(`[${startTimeFormatted}] - 🗄️ Redis cache MISS for email check: ${email}`);
      usedRedis = false;
    }

    // Use lean query for better performance - only check existence
    const user = await User.findOne({ 
      email: email.toLowerCase().trim(), 
      isActive: true 
    }).select('email name').lean();

    const exists = !!user;

    if (!exists) {
      // Cache that email doesn't exist for 5 minutes
      await setJSON(emailCacheKey, false, 300);
      console.log(`[${startTimeFormatted}] - 💾 Cached email not exists result: ${email}`);
      return res.status(200).json({
        success: true,
        message: 'Email not found',
        exists: false,
        email: null,
      });
    }

    // Cache that email exists for 5 minutes
    await setJSON(emailCacheKey, true, 300);
    console.log(`[${startTimeFormatted}] - 💾 Cached email exists result: ${email}`);

    // Email exists, generate and send OTP
    try {
      // Generate unique OTP using timestamp + random (same as registration)
      const timestamp = Date.now().toString().slice(-3);
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      const otp = timestamp + random;
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

      // Cache OTP in Redis for faster access and backup
      const otpCacheKey = `password_reset_otp:${email.toLowerCase()}`;
      await setJSON(otpCacheKey, {
        otp,
        expiry: otpExpiry.toISOString(),
        email: email.toLowerCase()
      }, 600); // 10 minutes TTL
      console.log(`[${startTimeFormatted}] - 💾 Password reset OTP cached in Redis: ${email}`);

      // Store OTP in user document as backup
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
        from: `"${process.env.STORE_NAME}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
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
