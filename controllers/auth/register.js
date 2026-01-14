const { validationResult } = require('express-validator');
const User = require('../../models/User');
const { generateToken } = require('../../utils/jwt');

/**
 * @desc    Register user with OTP verification
 * @route   POST /api/auth/register
 * @access  Public
 * 
 * Features:
 * - Generates OTP and stores pending registration data
 * - Sends OTP via email using same pattern as updateEmail
 * - Returns temporary token valid only for email verification
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

    // Generate unique oneSignalUserId (yy,mm,dd,hh,mm,ss,ms)
    const now = new Date();
    const oneSignalUserId = `${now.getFullYear().toString().slice(-2)}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}${now.getMilliseconds().toString().padStart(3, '0')}`;

    // Detect signup platform from User-Agent
    const userAgent = req.headers['user-agent'] || '';
    let signupPlatform = 'web'; // default
    
    if (userAgent.includes('wv') || userAgent.includes('WebView') || 
        (userAgent.includes('Mobile') && userAgent.includes('wv'))) {
      signupPlatform = 'webview'; // Web app wrapped in native WebView
    } else if (userAgent.includes('Mobile') || userAgent.includes('Android') || 
               userAgent.includes('iPhone') || userAgent.includes('iPad')) {
      signupPlatform = 'mobile'; // Native mobile app
    }

    // Store registration data with OTP in User model as pending registration
    const pendingUser = {
      name,
      email,
      password, // Will be hashed when actually creating user
      emailVerificationOtp: otp,
      emailVerificationOtpExpiry: otpExpiry,
      oneSignalUserId,
      signupPlatform,
      isPendingVerification: true,
      createdAt: new Date()
    };

    // For now, store in memory (in production, use Redis or temp collection)
    global.pendingRegistrations = global.pendingRegistrations || {};
    global.pendingRegistrations[email] = pendingUser;



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
      });
    }

    // Generate temporary token for email verification only
    const tempToken = generateToken({ 
      email: email,
      type: 'email_verification',
      temp: true // Flag to indicate this is a temporary token
    }, '15m'); // Token expires in 15 minutes

    return res.status(200).json({
      success: true,
      message: 'Verification code sent to your email. Please verify to complete registration.',
      email: email, // Return email for verification step
      tempToken, // Temporary token for email verification only
      signupPlatform, // Include detected signup platform
      oneSignalUserId: signupPlatform === 'web' ? null : oneSignalUserId, // Return null for web platforms
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { register };
