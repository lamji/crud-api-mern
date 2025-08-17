const express = require('express');
const { body } = require('express-validator');
const { protect } = require('../middleware/auth');
const { register, login, getMe, updateProfile } = require('../controllers/authController');

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
router.post('/register', [
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
], register);

// @desc    Login user
// @route   POST /auth/login
// @access  Public
router.post('/login', [
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
  // - notEmpty(): must be provided
  // Docs: https://express-validator.github.io/docs/guides/validation-chain
  body('password')
    .notEmpty()
    .withMessage('Password is required')
], login);

// @desc    Get current user
// @route   GET /auth/me
// @access  Private
router.get('/me', protect, getMe);

// @desc    Update user profile
// @route   PUT /auth/profile
// @access  Private
router.put('/profile', protect, [
  // Validate and sanitize `name` (optional field)
  // - optional(): only validate if provided
  // - trim(): remove leading/trailing spaces
  // - isLength({ min: 2, max: 50 }): enforce reasonable length
  // Docs: https://express-validator.github.io/docs/guides/validation-chain
  //       https://express-validator.github.io/docs/guides/sanitization
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  // Validate and sanitize `email` (optional field)
  // - optional(): only validate if provided
  // - isEmail(): must be a valid email format
  // - normalizeEmail(): canonicalize email
  // Docs: https://express-validator.github.io/docs/guides/validation-chain
  //       https://express-validator.github.io/docs/guides/sanitization
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email')
], updateProfile);

module.exports = router;
