const express = require('express');
const { body } = require('express-validator');
const { protect } = require('../middleware/auth');
const {
  register,
  logout,
  login,
  getMe,
  updateProfile,
  guestLogin,
  checkEmail,
  resetPassword,
  resetPasswordVerify,
} = require('../controllers/authController');
const { validateRegister, validateLogin } = require('../validators/authValidator');
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
router.post('/check-email', [
  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail()
], checkEmail);

// @desc    Reset password
// @route   POST /auth/reset-password
// @access  Public
router.post('/reset-password', [
  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number'),
  body('token')
    .notEmpty()
    .withMessage('Reset token is required')
], resetPassword);

// @desc    Verify OTP for password reset
// @route   POST /auth/reset-password-verify
// @access  Public
router.post('/reset-password-verify', [
  body('otp')
    .notEmpty()
    .withMessage('OTP is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be 6 digits')
    .isNumeric()
    .withMessage('OTP must contain only numbers'),
  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail()
], resetPasswordVerify);

// @desc    Logout user
// @route   POST /auth/logout
// @access  Private
router.post('/logout', protect, logout);

// @desc    Verify email with OTP (for registration with temporary token)
// @route   POST /auth/verify-email
// @access  Public (with temporary token)
router.post('/verify-email', [
  body('otp')
    .notEmpty()
    .withMessage('OTP is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be exactly 6 digits'),
  body('tempToken')
    .optional()
    .notEmpty()
    .withMessage('Temporary token is required for registration verification')
], profileController.verifyEmail);

// @desc    Resend OTP
// @route   POST /auth/opt-resend
// @access  Public
router.post('/opt-resend', [
  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
], profileController.resendOtp);

module.exports = router;
