const { validationResult } = require('express-validator');
const User = require('../../models/User');
const { generateToken } = require('../../utils/jwt');
const { getJSON, setJSON } = require('../../utils/redis');

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
  const startTime = Date.now();
  const { formatDate } = require('../../utils/logging');
  const startTimeFormatted = formatDate(startTime);
  const { name, email, password } = req.body;
  let usedRedis = false; // Track if Redis was used
  console.log(`\n[${startTimeFormatted}] - 📝 REGISTRATION PROCESS STARTED | Email: ${email} | IP: ${req.ip}`);

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log(`[${startTimeFormatted}] - ❌ Registration Validation Failed | Email: "${email}" | Name: "${name}" | Password: "${password ? '[REDACTED]' : 'EMPTY'}" | Errors:`, errors.array());
      console.log(`[${startTimeFormatted}] - � Request Body:`, JSON.stringify(req.body, null, 2));
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    // Check Redis cache first for existing pending registration
    const pendingRegistrationKey = `pending_registration:${email.toLowerCase()}`;
    const existingPendingRegistration = await getJSON(pendingRegistrationKey);
    
    if (existingPendingRegistration) {
      console.log(`[${startTimeFormatted}] - 🎯 Redis cache HIT for pending registration: ${email}`);
      return res.status(400).json({
        success: false,
        message: 'Verification already sent. Please check your email or wait for the current code to expire.',
      });
    }

    // Check if user already exists directly from the database
    const existingUser = await User.findOne({ email: email.toLowerCase() }).lean();
    if (existingUser) {
      console.log(`[${startTimeFormatted}] - ❌ Email already exists: ${email}`);
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

    // Generate unique createdAtKey (email + timestamp)
    const createdAtKey = `${email}_${Date.now()}`;

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

    // Store registration data with OTP in Redis instead of memory
    const pendingUser = {
      name,
      email,
      password, // Will be hashed when actually creating user
      emailVerificationOtp: otp,
      emailVerificationOtpExpiry: otpExpiry,
      createdAtKey,
      signupPlatform,
      isPendingVerification: true,
      createdAt: new Date()
    };

    // Cache pending registration data for 15 minutes (OTP expiry time)
    await setJSON(pendingRegistrationKey, pendingUser, 900);
    console.log(`[${startTimeFormatted}] - 💾 Pending registration cached in Redis: ${email}`);

    // Generate temporary token for email verification only
    const tempToken = generateToken({ 
      email: email,
      type: 'email_verification',
      temp: true // Flag to indicate this is a temporary token
    }, '15m'); // Token expires in 15 minutes

    // Send email asynchronously without blocking the registration process
    // This prevents blocking the registration process but captures email status
    const emailPromise = sendVerificationEmailAsync(email, name, otp, startTimeFormatted);
    
    // Don't await email sending - let it run in background
    emailPromise.catch(error => {
      console.error(`[${startTimeFormatted}] - 📧 Background email error: ${error.message}`);
    });

    const responseTime = Date.now() - startTime;
    console.log(`[${startTimeFormatted}] - ✅ REGISTRATION SUCCESSFUL | Total time: ${responseTime}ms | Redis: ${usedRedis}`);

    // Email sent successfully (background process)
    const responseData = {
      success: true,
      message: 'Verification code sent to your email. Please verify to complete registration.',
      email: email,
      tempToken,
      signupPlatform,
      createdAtKey: signupPlatform === 'web' ? null : createdAtKey,
      emailStatus: 'sending',
      emailError: null
    };

    // Include OTP in development mode for easier testing
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev') {
      responseData.otp = otp;
      console.log(`[${startTimeFormatted}] - 🧪 Development Mode: OTP included in response: ${otp}`);
    }

    return res.status(201).json(responseData);
  } catch (error) {
    console.log(`[${startTimeFormatted}] - 💥 REGISTRATION ERROR: ${error.message}`);
    return next(error);
  }
}

/**
 * Send verification email asynchronously without blocking the registration process
 * @param {string} email - Recipient email
 * @param {string} name - Recipient name
 * @param {string} otp - Verification code
 * @param {string} startTimeFormatted - Formatted start time for logging
 */
async function sendVerificationEmailAsync(email, name, otp, startTimeFormatted) {
  const emailStartTime = Date.now();
  const { formatDate } = require('../../utils/logging');
  
  try {
    const nodemailer = require('nodemailer');
    
    // Create transporter based on service (optimized for performance)
    let transporter;
    
    if (process.env.EMAIL_SERVICE === 'gmail') {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        },
        // Connection pooling for better performance
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        rateDelta: 1000,
        rateLimit: 5
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
        },
        pool: true,
        maxConnections: 3,
        maxMessages: 50
      });
      console.log('Ethereal test account:', testAccount);
    } else if (process.env.EMAIL_SERVICE === 'namecheap') {
      transporter = nodemailer.createTransport({
        host: 'mail.privateemail.com',
        port: 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        rateDelta: 2000,
        rateLimit: 3
      });
    } else {
      transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT || 587,
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 100
      });
    }

    const emailContent = {
      from: `"${process.env.STORE_NAME}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
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
    const emailTime = Date.now() - emailStartTime;
    console.log(`[${formatDate()}] - 📧 Email sent successfully to: ${email} | Time: ${emailTime}ms`);
    
    // If using Ethereal, show preview URL
    if (process.env.EMAIL_SERVICE === 'ethereal' && result.messageId) {
      console.log('Preview URL:', nodemailer.getTestMessageUrl(result));
    }
    
    // Close connection pool to free resources
    transporter.close();
    
    return { success: true, message: 'Email sent successfully', time: emailTime };
  } catch (emailError) {
    const emailTime = Date.now() - emailStartTime;
    console.error(`[${formatDate()}] - 📧 Email sending failed for ${email} | Time: ${emailTime}ms | Error: ${emailError.message}`);
    
    // Fallback to console logging for testing
    console.log(`Registration OTP for ${email}: ${otp}`);
    console.log(`OTP expires at: ${new Date(Date.now() + 10 * 60 * 1000).toISOString()}`);
    
    return { 
      success: false, 
      error: emailError.message,
      time: emailTime,
      fallbackProvided: true
    };
  }
}

module.exports = { register };
