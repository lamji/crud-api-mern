const { body } = require('express-validator');

// Add item to cart validation
const validateAddToCart = [
  body('productId')
    .notEmpty()
    .withMessage('Product is required')
    .isMongoId()
    .withMessage('Invalid product ID format'),
  body('quantity')
    .notEmpty()
    .withMessage('Quantity is required')
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1'),
  body('price')
    .notEmpty()
    .withMessage('Price is required')
    .isFloat({ min: 0 })
    .withMessage('Price cannot be negative'),
  body('size')
    .optional()
    .isString()
    .withMessage('Size must be a string')
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage('Size must be between 1 and 20 characters')
];

// Update cart item validation
const validateUpdateCartItem = [
  body('quantity')
    .notEmpty()
    .withMessage('Quantity is required')
    .isInt({ min: 0 })
    .withMessage('Quantity must be 0 or greater')
];

module.exports = {
  validateAddToCart,
  validateUpdateCartItem
};
