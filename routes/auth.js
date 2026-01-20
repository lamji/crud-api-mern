const express = require('express');
const { protect } = require('../middleware/auth');
const {
  register,
  logout,
  login,
  checkEmail,
  resetPassword,
  resetPasswordVerify,
  cashierLogout,
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
router.post('/logout/cashier', protect, cashierLogout);

// @desc    Verify email with OTP (for registration with temporary token)
// @route   POST /auth/verify-email
// @access  Public (with temporary token)
router.post('/verify-email', validateVerifyEmail, profileController.verifyEmail);

// @desc    Resend OTP
// @route   POST /auth/opt-resend
// @access  Public
router.post('/opt-resend', validateResendOtp, profileController.resendOtp);

module.exports = router;
