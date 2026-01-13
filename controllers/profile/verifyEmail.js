const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const Profile = require('../../models/Profile');
const User = require('../../models/User');
const { generateToken, verifyToken } = require('../../utils/jwt');

/**
 * @desc    Verify email with OTP
 * @route   POST /api/profile/verify-email
 * @access  Private
 */
exports.verifyEmail = async (req, res) => {
  try {
    const { otp, tempToken } = req.body;
    let email = null;
    let isTempTokenVerification = false;

    // Check if this is a temporary token verification (registration)
    if (tempToken) {
      try {
        const decoded = verifyToken(tempToken);
        
        // Validate this is a temporary email verification token
        if (decoded.type === 'email_verification' && decoded.temp) {
          email = decoded.email;
          isTempTokenVerification = true;
        } else {
          return res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
          });
        }
      } catch (tokenError) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired token'
        });
      }
    }

    if (!otp || typeof otp !== 'string' || otp.trim().length !== 6) {
      return res.status(400).json({
        success: false,
        message: 'Valid 6-digit OTP is required'
      });
    }

    // First check if this is a registration verification
    if (global.pendingRegistrations) {
      for (const [regEmail, pendingReg] of Object.entries(global.pendingRegistrations)) {
        // For temp token verification, only check the specific email
        // For regular verification, check all pending registrations
        const emailMatch = isTempTokenVerification ? regEmail === email : true;
        
        console.log(`Checking registration for ${regEmail}. Match: ${emailMatch}, OTP Match: ${pendingReg.emailVerificationOtp === otp.trim()}`);

        if (emailMatch &&
            pendingReg.emailVerificationOtp === otp.trim() && 
            new Date() <= pendingReg.emailVerificationOtpExpiry) {
          
          // This is a valid registration OTP - create the user account and profile atomically
          const session = await mongoose.startSession();
          session.startTransaction();
          try {
            const user = await User.create([{
              name: pendingReg.name,
              email: pendingReg.email,
              password: pendingReg.password,
              emailVerified: true,
              emailVerifiedAt: new Date(),
              oneSignalUserId: pendingReg.oneSignalUserId
            }], { session });

            const newUser = user[0];

            // Create corresponding profile document using service
            const { createDefaultProfile } = require('../../utils/profileService');
            await createDefaultProfile(newUser, pendingReg.name, pendingReg.oneSignalUserId, session);

            await session.commitTransaction();
            session.endSession();

            // Send welcome email using Namecheap setup
            console.log('Sending welcome email to:', pendingReg.email);
            try {
              const nodemailer = require('nodemailer');
              
              // Create transporter using Namecheap setup (same as register.js)
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
                console.log('Ethereal test account:', testAccount);
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

              const welcomeEmailContent = {
                from: `"HotShop" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
                to: pendingReg.email,
                subject: 'Welcome to HotShop! 🎉',
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Welcome to HotShop!</h2>
                    <p>Hi ${pendingReg.name},</p>
                    <p>Your registration is complete. Welcome aboard!</p>
                    <p>We're excited to have you join our community. Here's what you can do next:</p>
                    <ul>
                      <li>Explore our features</li>
                      <li>Complete your profile</li>
                      <li>Start using our services</li>
                    </ul>
                    <p>If you have any questions, feel free to reach out to our support team.</p>
                    <hr style="border: 1px solid #eee; margin: 30px 0;">
                    <p style="color: #666; font-size: 12px;">
                      This is an automated message. Please do not reply to this email.
                    </p>
                  </div>
                `
              };

              const result = await transporter.sendMail(welcomeEmailContent);
              
              if (process.env.EMAIL_SERVICE === 'ethereal' && result.messageId) {
                console.log('Welcome email preview URL:', nodemailer.getTestMessageUrl(result));
              }
              
              console.log('Welcome email sent successfully to:', pendingReg.email);
            } catch (emailError) {
              console.error('Error sending welcome email:', emailError);
              // Don't fail the registration if welcome email fails
            }

            // Clean up pending registration after use
            delete global.pendingRegistrations[regEmail];

            // Generate JWT token with role included
            const token = generateToken({ 
              id: newUser._id,
              role: newUser.role 
            });

            return res.status(201).json({
              success: true,
              message: 'Registration completed successfully',
              token,
              user: {
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
                emailVerified: newUser.emailVerified,
                emailVerifiedAt: newUser.emailVerifiedAt,
                createdAt: newUser.createdAt
              },
              oneSignalUserId: pendingReg.oneSignalUserId,
              userName:pendingReg.name
            });
          } catch (error) {
            await session.abortTransaction();
            session.endSession();
            console.error('Error creating user during registration verification:', error);
            return res.status(500).json({
              success: false,
              message: 'Failed to complete registration. Please try again.'
            });
          }
        }
      }
    }

    // If not a registration verification, proceed with profile email verification
    // Only check profile if this is not a temporary token verification
    if (!isTempTokenVerification) {
      let profile = await Profile.findOne({ userId: req.user.id }).lean();
      
      console.log('Profile verification flow - profile found:', !!profile);
      console.log('Profile emailVerified status:', profile?.emailVerified);
      
      if (!profile) {
        return res.status(404).json({
          success: false,
          message: 'Profile not found'
        });
      }

      // If email is already verified, return success
      if (profile.emailVerified) {
        return res.status(200).json({
          success: true,
          message: 'Email is already verified',
          profile
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

      // Check if OTP matches
      if (profile.emailVerificationOtp !== otp.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid verification code'
        });
      }

      // Check OTP attempts
      if (profile.emailVerificationOtpAttempts >= 3) {
        return res.status(429).json({
          success: false,
          message: 'Too many failed attempts. Please request a new verification code.'
        });
      }

      // Update profile with verified email
      const updatedProfile = await Profile.findOneAndUpdate(
        { userId: req.user.id },
        {
          $set: {
            email: profile.pendingEmail,
            emailVerified: true, // Fixed field name
            emailVerifiedAt: new Date(),
            updatedAt: new Date()
          },
          $unset: {
            pendingEmail: 1,
            emailVerificationOtp: 1,
            emailVerificationOtpExpiry: 1,
            emailVerificationOtpAttempts: 1,
            emailVerificationOtpLastAttempt: 1
          }
        },
        { new: true, runValidators: true }
      ).select('-_id -userId');

      // Also update the User model
      await User.findByIdAndUpdate(req.user.id, {
        $set: {
          emailVerified: true,
          emailVerifiedAt: new Date()
        }
      });

      return res.status(200).json({
        success: true,
        message: 'Email verified successfully',
        profile: updatedProfile
      });
    }

    // If we reach here with tempToken but no matching registration was found
    if (isTempTokenVerification) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification code'
      });
    }

    // Regular flow - no tempToken and no registration found
    return res.status(404).json({
      success: false,
      message: 'User not found or inactive'
    });
  } catch (error) {
    console.error('Email verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
