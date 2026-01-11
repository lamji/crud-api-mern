const express = require('express');
const { body } = require('express-validator');
const { protect } = require('../middleware/auth');
const { getProfile, updateProfile, updateFullName, updateEmail, sendEmailVerification, verifyEmail } = require('../controllers/profileController');

const router = express.Router();

// All profile routes are protected
router.use(protect);

/**
 * @route   GET /api/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/', getProfile);

/**
 * @route   PUT /api/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/', [
  body('firstName').optional().notEmpty().withMessage('First name cannot be empty'),
  body('lastName').optional().notEmpty().withMessage('Last name cannot be empty'),
  body('email').optional().isEmail().withMessage('Please provide a valid email'),
  body('gender').optional().isIn(['male', 'female', 'other']).withMessage('Invalid gender value'),
  body('preferences').optional().isObject().withMessage('Preferences must be an object'),
  body('phones').optional().isArray().withMessage('Phones must be an array'),
  body('addresses').optional().isArray().withMessage('Addresses must be an array'),
  body('paymentMethods').optional().isArray().withMessage('Payment methods must be an array')
], updateProfile);

/**
 * @route   PUT /api/profile/fullname
 * @desc    Update user full name (single string)
 * @access  Private
 */
router.put('/fullname', [
  body('firstName')
    .notEmpty()
    .withMessage('First name is required')
    .isString()
    .withMessage('First name must be a string')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters'),
  body('lastName')
    .optional()
    .isString()
    .withMessage('Last name must be a string')
    .trim()
    .isLength({ max: 50 })
    .withMessage('Last name cannot be more than 50 characters')
], updateFullName);

/**
 * @route   PUT /api/profile/email
 * @desc    Update user email
 * @access  Private
 */
router.put('/email', [
  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
], updateEmail);

/**
 * @route   POST /api/profile/send-verification
 * @desc    Send email verification OTP
 * @access  Private
 */
router.post('/send-verification', sendEmailVerification);

/**
 * @route   POST /api/profile/verify-email
 * @desc    Verify email with OTP
 * @access  Private
 */
router.post('/verify-email', [
  body('otp')
    .notEmpty()
    .withMessage('OTP is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be exactly 6 digits')
    .isNumeric()
    .withMessage('OTP must contain only numbers')
], verifyEmail);

module.exports = router;
