const express = require('express');
const { body } = require('express-validator');
const { protect } = require('../middleware/auth');
const {
  register,
  logout,
  login,
  guestLogin,
  checkEmail,
  resetPassword,
  resetPasswordVerify,
} = require('../controllers/authController');
const { registerCashier } = require('../controllers/auth');
const { validateRegister, validateLogin, validateCheckEmail, validateResetPassword, validateResetPasswordVerify, validateVerifyEmail, validateResendOtp } = require('../validators/authValidator');
const { validateRegisterCashier } = require('../validators/cashierValidator');
const profileController = require('../controllers/profile/index');

const router = express.Router();

// Router for authentication endpoints. Mounted at `/api/auth` in `server.js`.
// Notes on imports used here:
// - `express-validator`: declaratively validates request bodies (returns 400 on invalid input)
// - `User` model: Mongoose schema with password hashing (pre('save')) and helpers
// - `generateToken(payload)`: issues a signed JWT using `JWT_SECRET` and `JWT_EXPIRE` from `.env`
// - `protect` middleware: verifies `Authorization: Bearer <token>` and populates `req.user`

// @desc    Register user
// @route   POST /auth/register
// @access  Public
router.post('/register', validateRegister, register);

// @desc    Register cashier (direct registration, no OTP required)
// @route   POST /auth/register/cashier
// @access  Public
router.post('/register/cashier', validateRegisterCashier, registerCashier);

// @desc    Login user
// @route   POST /auth/login
// @access  Public
router.post('/login', validateLogin, login);

// @desc    Guest login
// @route   POST /auth/guest-login
// @access  Public
router.post('/guest-login', guestLogin);

// @desc    Check if email exists
// @route   POST /auth/check-email
// @access  Public
router.post('/check-email', validateCheckEmail, checkEmail);

// @desc    Reset password
// @route   POST /auth/reset-password
// @access  Public
router.post('/reset-password', validateResetPassword, resetPassword);

// @desc    Verify OTP for password reset
// @route   POST /auth/reset-password-verify
// @access  Public
router.post('/reset-password-verify', validateResetPasswordVerify, resetPasswordVerify);

// @desc    Logout user
// @route   POST /auth/logout
// @access  Private
router.post('/logout', protect, logout);

// @desc    Logout cashier (clear active session)
// @route   POST /auth/logout/cashier
// @access  Private (Cashier only)
router.post('/logout/cashier', protect, async (req, res) => {
  try {
    // Check if user is a cashier
    if (req.user?.role !== process.env.CASHIER_KEY) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Cashier logout only.',
        statusCode: 403
      });
    }

    // Find cashier and clear session
    const Cashier = require('../models/Cashier');
    const cashier = await Cashier.findById(req.user.id);
    
    if (!cashier) {
      return res.status(404).json({
        success: false,
        message: 'Cashier not found',
        statusCode: 404
      });
    }

    // Record logout to clear active session
    await cashier.recordLogout(req.ip, req.get('User-Agent'));

    res.status(200).json({
      success: true,
      message: 'Cashier logged out successfully',
      statusCode: 200
    });

  } catch (error) {
    console.error('Cashier logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      statusCode: 500
    });
  }
});

// @desc    Verify email with OTP (for registration with temporary token)
// @route   POST /auth/verify-email
// @access  Public (with temporary token)
router.post('/verify-email', validateVerifyEmail, profileController.verifyEmail);

// @desc    Resend OTP
// @route   POST /auth/opt-resend
// @access  Public
router.post('/opt-resend', validateResendOtp, profileController.resendOtp);

module.exports = router;
