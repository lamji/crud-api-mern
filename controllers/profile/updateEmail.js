const { validationResult } = require('express-validator');
const Profile = require('../../models/Profile');

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
    const profile = await Profile.findOne({ userId: req.user.id }).select('email firstName otpLastSent');

    // Check if email is the same as current
    if (profile && profile.email === trimmedEmail) {
      return res.status(400).json({
        success: false,
        message: 'This email is already your current email'
      });
    }

    // Rate limiting: Check for last sent OTP time (1 minute cooldown)
    if (profile && profile.otpLastSent && (Date.now() - profile.otpLastSent < 60000)) {
      const remainingSeconds = Math.ceil((60000 - (Date.now() - profile.otpLastSent)) / 1000);
      return res.status(429).json({
        success: false,
        message: `Please wait ${remainingSeconds} seconds before requesting another code.`
      });
    }

    // Generate unique OTP using timestamp + random
    const timestamp = Date.now().toString().slice(-3);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const otp = timestamp + random;
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Store pending email and OTP with timestamp
    await Profile.findOneAndUpdate(
      { userId: req.user.id },
      { 
        $set: { 
          pendingEmail: trimmedEmail,
          emailVerificationOtp: otp,
          emailVerificationOtpExpiry: otpExpiry,
          otpLastSent: Date.now()
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
