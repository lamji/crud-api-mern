const { validationResult } = require('express-validator');
const Profile = require('../models/Profile');

/**
 * @desc    Get current user profile
 * @route   GET /api/profile
 * @access  Private
 */
exports.getProfile = async (req, res) => {
  try {
    let profile = await Profile.findOne({ userId: req.user.id });

    if (!profile) {
      // Create a default profile if it doesn't exist
      profile = await Profile.create({
        userId: req.user.id,
        firstName: req.user.name.split(' ')[0] || 'User',
        lastName: req.user.name.split(' ').slice(1).join(' ') || '',
        email: req.user.email,
        preferences: {
          newsletter: false,
          smsNotifications: false,
          pushNotifications: false,
          language: 'en',
          currency: 'PHP'
        }
      });
    }

    res.status(200).json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/profile
 * @access  Private
 */
exports.updateProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const updatableFields = [
      'firstName', 'lastName', 'phones', 'avatar', 
      'dateOfBirth', 'gender', 'bio', 'preferences',
      'addresses', 'paymentMethods'
    ];

    const updateData = {};
    updatableFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    const profile = await Profile.findOneAndUpdate(
      { userId: req.user.id },
      { $set: updateData },
      { new: true, runValidators: true, upsert: true }
    );

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: profile
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * @desc    Update user full name (single string)
 * @route   PUT /api/profile/fullname
 * @access  Private
 */
exports.updateFullName = async (req, res) => {
  try {
    const { firstName, lastName } = req.body;

    if (!firstName || typeof firstName !== 'string' || firstName.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'First name is required and must be a non-empty string'
      });
    }

    // Validate lastName if provided
    if (lastName && (typeof lastName !== 'string' || lastName.trim().length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Last name must be a non-empty string if provided'
      });
    }

    const profile = await Profile.findOneAndUpdate(
      { userId: req.user.id },
      { 
        $set: { 
          firstName: firstName.trim(),
          lastName: lastName ? lastName.trim() : ''
        }
      },
      { new: true, runValidators: true, upsert: true }
    );

    res.status(200).json({
      success: true,
      message: 'Name updated successfully',
      data: profile
    });
  } catch (error) {
    console.error('Error updating name:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * @desc    Update user email
 * @route   PUT /api/profile/email
 * @access  Private
 */
exports.updateEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string' || email.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Email is required and must be a non-empty string'
      });
    }

    // Basic email validation
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    const trimmedEmail = email.trim();
    const profile = await Profile.findOne({ userId: req.user.id });

    // Check if email is the same as current
    if (profile && profile.email === trimmedEmail) {
      return res.status(400).json({
        success: false,
        message: 'This email is already your current email'
      });
    }

    // Generate unique OTP using timestamp + random
    const timestamp = Date.now().toString().slice(-3);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const otp = timestamp + random;
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Store pending email and OTP
    await Profile.findOneAndUpdate(
      { userId: req.user.id },
      { 
        $set: { 
          pendingEmail: trimmedEmail,
          emailVerificationOtp: otp,
          emailVerificationOtpExpiry: otpExpiry
        }
      },
      { upsert: true }
    );

    // Log OTP for development (in production, send actual email)
    console.log(`Email verification OTP for ${trimmedEmail}: ${otp}`);
    console.log(`OTP expires at: ${otpExpiry.toISOString()}`);

    // Send email using Nodemailer
    try {
      // Check if email service is configured
      // if (!process.env.EMAIL_SERVICE || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      //   console.warn('Email service not configured. Please set EMAIL_SERVICE, EMAIL_USER, and EMAIL_PASS environment variables.');
      //   console.log(`Email verification OTP for ${trimmedEmail}: ${otp}`);
      //   console.log(`OTP expires at: ${otpExpiry.toISOString()}`);
        
      //   // Return success but indicate email service is not configured
      //   return res.status(200).json({
      //     success: true,
      //     message: 'Verification code generated (email service not configured)',
      //     // In development, include OTP for testing
      //     ...(process.env.NODE_ENV === 'development' && { otp })
      //   });
      // }

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
        // Use Namecheap Private Email
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
        // Custom SMTP configuration
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
        to: trimmedEmail,
        subject: 'Verify Your New Email Address',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Email Verification</h2>
            <p>Hi ${profile.firstName},</p>
            <p>You requested to update your email to: <strong>${trimmedEmail}</strong></p>
            <p>Your verification code is:</p>
            <div style="background: #f0f0f0; padding: 20px; text-align: center; margin: 20px 0;">
              <span style="font-size: 24px; font-weight: bold; letter-spacing: 3px; color: #333;">${otp}</span>
            </div>
            <p>This code will expire in 10 minutes.</p>
            <p>If you didn't request this change, please ignore this email.</p>
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
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      // Fallback to console logging
      console.log(`Email verification OTP for ${trimmedEmail}: ${otp}`);
      console.log(`OTP expires at: ${otpExpiry.toISOString()}`);
      
      // Return failed status since email couldn't be sent
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification email. Please try again later.',
        // In development, include OTP for testing
        ...(process.env.NODE_ENV === 'development' && { otp })
      });
    }

    res.status(200).json({
      success: true,
      message: 'Verification code sent to your new email. Please verify to complete the email update.',
      // In development, include OTP for testing
      ...(process.env.NODE_ENV === 'development' && { otp })
    });
  } catch (error) {
    console.error('Error updating email:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * @desc    Send email verification OTP
 * @route   POST /api/profile/send-verification
 * @access  Private
 */
exports.sendEmailVerification = async (req, res) => {
  try {
    const profile = await Profile.findOne({ userId: req.user.id });
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    // Generate unique OTP using timestamp + random
    const timestamp = Date.now().toString().slice(-3);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const otp = timestamp + random;
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Store OTP in profile
    await Profile.findOneAndUpdate(
      { userId: req.user.id },
      { 
        $set: { 
          emailVerificationOtp: otp,
          emailVerificationOtpExpiry: otpExpiry
        }
      }
    );

    // Send email using Nodemailer
    try {
      // Check if email service is configured
      if (!process.env.EMAIL_SERVICE || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('Email service not configured. Please set EMAIL_SERVICE, EMAIL_USER, and EMAIL_PASS environment variables.');
        
        // Return success but indicate email service is not configured
        return res.status(200).json({
          success: true,
          message: 'Verification code generated (email service not configured)',
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
       
      } else if (process.env.EMAIL_SERVICE === 'namecheap') {
        // Use Namecheap Private Email
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
        // Custom SMTP configuration
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
        to: profile.email,
        subject: 'Verify Your Email Address',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Email Verification</h2>
            <p>Hi ${profile.firstName},</p>
            <p>Your verification code is:</p>
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
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      // Fallback to logging OTP for development
      console.log(`Email verification OTP for ${profile.email}`);
      console.log(`OTP expires at: ${otpExpiry.toISOString()}`);
      
      // Return failed status since email couldn't be sent
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification email. Please try again later.',
      });
    }
    console.log(`Email verification was successfully sent to ${profile.email}`);
    res.status(200).json({
      success: true,
      message: 'Verification code sent to your email',
    });
  } catch (error) {
    console.error('Error sending email verification:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

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

    const profile = await Profile.findOne({ userId: req.user.id });
    
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
      // Lock account for 5 minutes after 5 failed attempts
      const lockUntil = new Date(Date.now() + 5 * 60 * 1000);
      await Profile.findOneAndUpdate(
        { userId: req.user.id },
        { $set: { otpLockedUntil: lockUntil } }
      );
      
      return res.status(429).json({
        success: false,
        message: 'Too many failed attempts. Account locked.'
      });
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
    );

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
