const { validationResult } = require('express-validator');
const User = require('../models/User');
const { generateToken } = require('../utils/jwt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

/**
 * Handle user registration with OTP verification
 * - Validates request using express-validator's validationResult
 * - Checks for duplicate email using lean queries
 * - Generates OTP and stores in User model
 * - Sends OTP via email using same pattern as updateEmail
 * - Returns success message indicating OTP sent
 * - Uses existing verifyEmail endpoint for verification
 * - Optimized for high-volume requests with lean queries
 */
async function register(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { name, email, password } = req.body;

    // Check database for existing email using lean query for performance
    const existingUser = await User.findOne({ email }).lean();
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email',
      });
    }

    // Generate unique OTP using timestamp + random (same pattern as updateEmail)
    const timestamp = Date.now().toString().slice(-3);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const otp = timestamp + random;
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Store registration data with OTP in User model as pending registration
    const pendingUser = {
      name,
      email,
      password, // Will be hashed when actually creating user
      emailVerificationOtp: otp,
      emailVerificationOtpExpiry: otpExpiry,
      isPendingVerification: true,
      createdAt: new Date()
    };

    // For now, store in memory (in production, use Redis or temp collection)
    global.pendingRegistrations = global.pendingRegistrations || {};
    global.pendingRegistrations[email] = pendingUser;

    // Log OTP for development (in production, send actual email)
    console.log(`Registration OTP for ${email}: ${otp}`);
    console.log(`OTP expires at: ${otpExpiry.toISOString()}`);

    // Send email using Nodemailer (exact same as updateEmail)
    try {
      const nodemailer = require('nodemailer');
      
      // Create transporter based on service (exact same as updateEmail)
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
        // Use Ethereal for testing (free fake email service)
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
        console.log('Ethereal test account:', testAccount);
      } else if (process.env.EMAIL_SERVICE === 'namecheap') {
        // Use Namecheap Private Email (exact same as updateEmail)
        transporter = nodemailer.createTransport({
          host: 'mail.privateemail.com',
          port: 587, // Use 587 for TLS/STARTTLS
          secure: false, // false for TLS/STARTTLS
          auth: {
            user: process.env.EMAIL_USER, // yourname@yourdomain.com
            pass: process.env.EMAIL_PASS // your_private_email_password
          }
        });
      } else {
        // Custom SMTP configuration (exact same as updateEmail)
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
        to: email,
        subject: 'Verify Your Email Address - Complete Registration',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Email Verification</h2>
            <p>Hi ${name},</p>
            <p>Thank you for registering! Please verify your email address to complete your registration.</p>
            <p>Your verification code is:</p>
            <div style="background: #f0f0f0; padding: 20px; text-align: center; margin: 20px 0;">
              <span style="font-size: 24px; font-weight: bold; letter-spacing: 3px; color: #333;">${otp}</span>
            </div>
            <p>This code will expire in 10 minutes.</p>
            <p>If you didn't request this registration, please ignore this email.</p>
            <hr style="border: 1px solid #eee; margin: 30px 0;">
            <p style="color: #666; font-size: 12px;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        `
      };

      const result = await transporter.sendMail(emailContent);
    
      
      // If using Ethereal, show preview URL (exact same as updateEmail)
      if (process.env.EMAIL_SERVICE === 'ethereal' && result.messageId) {
        console.log('Preview URL:', nodemailer.getTestMessageUrl(result));
      }
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      // Fallback to console logging (exact same as updateEmail)
      console.log(`Registration OTP for ${email}: ${otp}`);
      console.log(`OTP expires at: ${otpExpiry.toISOString()}`);
      
      // Return failed status since email couldn't be sent (exact same as updateEmail)
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification email. Please try again later.',
        // In development, include OTP for testing
        ...(process.env.NODE_ENV === 'development' && { otp })
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Verification code sent to your email. Please verify to complete registration.',
      email: email, // Return email for verification step
      // In development, include OTP for testing
      ...(process.env.NODE_ENV === 'development' && { otp })
    });
  } catch (error) {
    return next(error);
  }
}

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
 * Get current authenticated user profile
 * - Uses lean queries for performance
 * - Optimized for high-volume requests
 */
async function getMe(req, res, next) {
  try {
    const userId = req.user.id;
    
    // Use lean query for better performance
    const user = await User.findById(userId).lean();
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const userData = {
      name: user.name,
      email: user.email,
      role: user.role,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
    };

    return res.status(200).json({
      success: true,
      user: userData,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Update user profile
 * - Validates optional name/email
 * - Uses atomic findByIdAndUpdate for concurrency safety
 * - Optimized for high-volume requests
 */
async function updateProfile(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { name, email } = req.body;
    const updateFields = {};

    if (name) updateFields.name = name;
    if (email) updateFields.email = email;

    // Atomic update for concurrency safety
    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateFields,
      { new: true, runValidators: true }
    ).lean();

    const userData = {
      name: user.name,
      email: user.email,
      role: user.role,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
    };

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: userData,
    });
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

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  guestLogin,
};
