const { body } = require('express-validator');

// Bulk upload products validation
const validateBulkUpload = [
  body('products')
    .isArray({ min: 1 })
    .withMessage('Products must be a non-empty array'),
  body('products.*.title')
    .notEmpty()
    .withMessage('Product title is required')
    .isString()
    .withMessage('Product title must be a string')
    .isLength({ min: 1, max: 200 })
    .withMessage('Product title must be between 1 and 200 characters'),
  body('products.*.price')
    .notEmpty()
    .withMessage('Product price is required')
    .isFloat({ min: 0 })
    .withMessage('Product price must be a positive number'),
  body('products.*.imageSrc')
    .notEmpty()
    .withMessage('Product image source is required')
    .isURL()
    .withMessage('Product image source must be a valid URL'),
  body('products.*.rating')
    .optional()
    .isFloat({ min: 0, max: 5 })
    .withMessage('Product rating must be between 0 and 5'),
  body('products.*.reviewCount')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Review count must be a non-negative integer'),
  body('products.*.stock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer'),
  body('products.*.originalPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Original price must be a positive number'),
  body('products.*.discountPercent')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Discount percent must be between 0 and 100'),
  body('products.*.category')
    .optional()
    .isString()
    .withMessage('Category must be a string'),
  body('products.*.categoryId')
    .optional()
    .isString()
    .withMessage('Category ID must be a string'),
  body('products.*.type')
    .optional()
    .isIn(['flash', 'new', 'regular'])
    .withMessage('Product type must be flash, new, or regular'),
  body('products.*.sizes')
    .optional()
    .isArray()
    .withMessage('Sizes must be an array'),
  body('products.*.images')
    .optional()
    .isArray()
    .withMessage('Images must be an array'),
  body('products.*.reviews')
    .optional()
    .isArray()
    .withMessage('Reviews must be an array')
];

module.exports = {
  validateBulkUpload
};
