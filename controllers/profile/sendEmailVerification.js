const Profile = require('../../models/Profile');
const nodemailer = require('nodemailer');

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
        from: `"${process.env.STORE_NAME}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
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
 * @desc    Resend OTP for email verification
 * @route   POST /api/auth/opt-resend
 * @access  Public
 */
exports.resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    
    // First check if it's a pending registration in memory
    const pendingRegistration = global.pendingRegistrations && global.pendingRegistrations[email];
    
    let targetRecord = null;
    let isPendingRegistration = false;
    
    if (pendingRegistration) {
      // This is a pending registration
      targetRecord = pendingRegistration;
      isPendingRegistration = true;
    } else {
      // Check existing profiles in database
      const profile = await Profile.findOne({ email });
      if (!profile) {
        return res.status(404).json({
          success: false,
          message: 'Email not found'
        });
      }
      targetRecord = profile;
    }

    // Rate limiting: Check for last sent OTP time (1 minute cooldown)
    if (targetRecord.otpLastSent && (Date.now() - targetRecord.otpLastSent < 60000)) {
      const remainingSeconds = Math.ceil((60000 - (Date.now() - targetRecord.otpLastSent)) / 1000);
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

    // Update the appropriate record with OTP
    if (isPendingRegistration) {
      // Update pending registration in memory
      global.pendingRegistrations[email].emailVerificationOtp = otp;
      global.pendingRegistrations[email].emailVerificationOtpExpiry = otpExpiry;
      global.pendingRegistrations[email].otpLastSent = Date.now();
    } else {
      // Update existing profile in database
      await Profile.findOneAndUpdate(
        { email },
        {
          $set: {
            emailVerificationOtp: otp,
            emailVerificationOtpExpiry: otpExpiry,
            otpLastSent: Date.now()
          }
        }
      );
    }

    // Send email using Nodemailer
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
        port: 587, // Use 587 for TLS/STARTTLS
        secure: false, // false for TLS/STARTTLS
        auth: {
          user: process.env.EMAIL_USER, // yourname@yourdomain.com
          pass: process.env.EMAIL_PASS // your_private_email_password
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
      to: email,
      subject: 'Your OTP Code',
      html: `<p>Your OTP code is <strong>${otp}</strong>. It will expire in 10 minutes.</p>`
    };

    const result = await transporter.sendMail(emailContent);

    if (process.env.EMAIL_SERVICE === 'ethereal' && result.messageId) {
      console.log('Preview URL:', nodemailer.getTestMessageUrl(result));
    }

    res.status(200).json({
      success: true,
      message: 'OTP sent successfully'
    });
  } catch (error) {
    console.error('Error resending OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend OTP. Please try again later.'
    });
  }
};
