const express = require('express');
const { body } = require('express-validator');
const { protect } = require('../middleware/auth');
const { register, logout, login, getMe, updateProfile, guestLogin } = require('../controllers/authController');
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
