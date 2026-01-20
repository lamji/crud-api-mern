const { validationResult } = require('express-validator');
const User = require('../../models/User');
const { getJSON, setJSON } = require('../../utils/redis');
const { formatDate } = require('../../utils/logging');

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

module.exports = { checkEmail };
