const express = require('express');
const { body } = require('express-validator');
const { protect } = require('../middleware/auth');
const profileController = require('../controllers/profile/index');

const router = express.Router();

// All profile routes are protected
router.use(protect);

/**
 * @route   GET /api/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/', profileController.getProfile);

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
], profileController.updateProfile);

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
], profileController.updateFullName);

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
], profileController.updateEmail);

/**
 * @route   POST /api/profile/send-verification
 * @desc    Send email verification OTP
 * @access  Private
 */
router.post('/send-verification', profileController.sendEmailVerification);

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
], profileController.verifyEmail);

/**
 * @route   POST /api/profile/phones
 * @desc    Add phone number to profile
 * @access  Private
 */
router.post('/phones', [
  body('number')
    .notEmpty()
    .withMessage('Phone number is required')
    .isString()
    .withMessage('Phone number must be a string')
    .trim()
    .matches(/^[+]?[\d\s\-\(\)]+$/)
    .withMessage('Please provide a valid phone number'),
  body('type')
    .optional()
    .isIn(['mobile', 'home', 'work'])
    .withMessage('Phone type must be mobile, home, or work'),
  body('isPrimary')
    .optional()
    .isBoolean()
    .withMessage('isPrimary must be a boolean')
], profileController.addPhone);

/**
 * @route   PUT /api/profile/phones/:phoneId
 * @desc    Update phone number
 * @access  Private
 */
router.put('/phones/:phoneId', [
  body('number')
    .optional()
    .isString()
    .withMessage('Phone number must be a string')
    .trim()
    .matches(/^[+]?[\d\s\-\(\)]+$/)
    .withMessage('Please provide a valid phone number'),
  body('type')
    .optional()
    .isIn(['mobile', 'home', 'work'])
    .withMessage('Phone type must be mobile, home, or work'),
  body('isPrimary')
    .optional()
    .isBoolean()
    .withMessage('isPrimary must be a boolean')
], profileController.updatePhone);

/**
 * @route   DELETE /api/profile/phones/:phoneId
 * @desc    Delete phone number
 * @access  Private
 */
router.delete('/phones/:phoneId', profileController.deletePhone);

/**
 * @route   POST /api/profile/batch
 * @desc    Get multiple profiles (batch operation)
 * @access  Private/Admin
 */
router.post('/batch', [
  body('userIds')
    .isArray({ min: 1, max: 100 })
    .withMessage('User IDs must be an array with 1-100 items'),
  body('userIds.*')
    .notEmpty()
    .withMessage('Each user ID is required'),
  body('fields')
    .optional()
    .isString()
    .withMessage('Fields must be a string')
], profileController.getMultipleProfiles);

/**
 * @route   DELETE /api/profile/cache
 * @desc    Clear profile cache
 * @access  Private
 */
router.delete('/cache', profileController.clearProfileCache);

/**
 * @route   POST /api/profile/reset-otp-lock
 * @desc    Reset OTP lock (utility function)
 * @access  Private
 */
router.post('/reset-otp-lock', profileController.resetOtpLock);

/**
 * @route   POST /api/profile/addresses
 * @desc    Add address to profile
 * @access  Private
 */
router.post('/addresses', profileController.addAddress);

/**
 * @route   PUT /api/profile/addresses/:addressId
 * @desc    Update address
 * @access  Private
 */
router.put('/addresses/:addressId', profileController.updateAddress);

/**
 * @route   DELETE /api/profile/addresses/:addressId
 * @desc    Delete address
 * @access  Private
 */
router.delete('/addresses/:addressId', profileController.deleteAddress);

module.exports = router;
