const { body } = require('express-validator');

// Register user validation
const validateRegister = [
  // Validate and sanitize `name` from req.body
  // - trim(): remove leading/trailing spaces (sanitization)
  // - isLength({ min: 2, max: 50 }): enforce a human-friendly length
  // Docs: https://express-validator.github.io/docs/guides/validation-chain
  //       https://express-validator.github.io/docs/guides/sanitization
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  // Validate and sanitize `email`
  // - isEmail(): must be a valid email format
  // - normalizeEmail(): canonicalize email (e.g., lowercases, removes dots for Gmail if configured)
  // Docs: https://express-validator.github.io/docs/guides/validation-chain
  //       https://express-validator.github.io/docs/guides/sanitization
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  // Validate `password`
  // - isLength({ min: 6 }): require a minimum level of complexity
  // Docs: https://express-validator.github.io/docs/guides/validation-chain
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
];

// Login user validation
const validateLogin = [
  // Validate and sanitize `email` from req.body
  // - Accept both email format and username (for cashiers)
  // - trim(): remove leading/trailing spaces
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email or username is required'),
  // Validate `password`
  // - notEmpty(): must be provided
  // Docs: https://express-validator.github.io/docs/guides/validation-chain
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Check email validation
const validateCheckEmail = [
  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail()
];

// Reset password validation
const validateResetPassword = [
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
];

// Reset password verify validation
const validateResetPasswordVerify = [
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
];

// Verify email validation
const validateVerifyEmail = [
  body('otp')
    .notEmpty()
    .withMessage('OTP is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be exactly 6 digits'),
  body('tempToken')
    .optional()
    .notEmpty()
    .withMessage('Temporary token is required for registration verification')
];

// Resend OTP validation
const validateResendOtp = [
  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
];

module.exports = {
  validateRegister,
  validateLogin,
  validateCheckEmail,
  validateResetPassword,
  validateResetPasswordVerify,
  validateVerifyEmail,
  validateResendOtp
};
