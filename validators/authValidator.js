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
];

module.exports = {
  validateRegister,
  validateLogin
};
