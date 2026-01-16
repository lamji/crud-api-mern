const { body } = require('express-validator');

// Validate payment intent creation
exports.validatePaymentIntent = [
  body('orderId')
    .notEmpty()
    .withMessage('Order ID is required'),
  body('amount')
    .isNumeric()
    .withMessage('Amount must be a number')
    .isFloat({ gt: 0 })
    .withMessage('Amount must be greater than 0'),
  body('paymentMethodAllowed')
    .optional()
    .isArray()
    .withMessage('Payment method allowed must be an array')
    .custom((value) => {
      const validMethods = ['card', 'gcash', 'paymaya', 'grab_pay', 'qrph', 'dob', 'billease', 'shopee_pay'];
      const invalidMethods = value.filter(method => !validMethods.includes(method));
      if (invalidMethods.length > 0) {
        throw new Error(`Invalid payment methods: ${invalidMethods.join(', ')}. Valid methods: ${validMethods.join(', ')}`);
      }
      return true;
    })
];

// Validate payment method creation
exports.validatePaymentMethod = [
  body('type')
    .notEmpty()
    .withMessage('Payment method type is required')
    .isIn(['card'])
    .withMessage('Payment method type must be card'),
  body('details')
    .notEmpty()
    .withMessage('Payment details are required')
    .isObject()
    .withMessage('Payment details must be an object'),
  body('details.card_number')
    .isLength({ min: 13, max: 19 })
    .withMessage('Card number must be between 13 and 19 digits')
    .matches(/^[0-9]+$/)
    .withMessage('Card number must contain only digits'),
  body('details.exp_month')
    .isInt({ min: 1, max: 12 })
    .withMessage('Expiration month must be between 1 and 12'),
  body('details.exp_year')
    .isInt({ min: new Date().getFullYear() })
    .withMessage('Expiration year must be current year or future'),
  body('details.cvc')
    .isLength({ min: 3, max: 4 })
    .withMessage('CVC must be 3 or 4 digits')
    .matches(/^[0-9]+$/)
    .withMessage('CVC must contain only digits'),
  body('billing')
    .optional()
    .isObject()
    .withMessage('Billing information must be an object'),
  body('billing.name')
    .if(body('billing').exists())
    .notEmpty()
    .withMessage('Billing name is required'),
  body('billing.email')
    .if(body('billing').exists())
    .isEmail()
    .withMessage('Billing email must be valid'),
  body('billing.phone')
    .if(body('billing').exists())
    .matches(/^\+?[0-9]{10,15}$/)
    .withMessage('Billing phone must be a valid phone number'),
  body('billing.address')
    .if(body('billing').exists())
    .notEmpty()
    .withMessage('Billing address is required')
];

// Validate payment method attachment
exports.validateAttachPayment = [
  body('paymentIntentId')
    .notEmpty()
    .withMessage('Payment intent ID is required'),
  body('paymentMethodId')
    .notEmpty()
    .withMessage('Payment method ID is required'),
  body('returnUrl')
    .optional()
    .isURL()
    .withMessage('Return URL must be a valid URL')
];

// Validate source creation
exports.validateSource = [
  body('orderId')
    .notEmpty()
    .withMessage('Order ID is required'),
  body('type')
    .notEmpty()
    .withMessage('Source type is required')
    .isIn(['gcash', 'paymaya', 'grab_pay', 'qrph', 'dob', 'billease', 'shopee_pay'])
    .withMessage('Source type must be gcash, paymaya, grab_pay, qrph, dob, billease, or shopee_pay'),
  body('amount')
    .isNumeric()
    .withMessage('Amount must be a number')
    .isFloat({ gt: 0 })
    .withMessage('Amount must be greater than 0'),
  body('redirect')
    .notEmpty()
    .withMessage('Redirect information is required')
    .isObject()
    .withMessage('Redirect must be an object'),
  body('redirect.success')
    .isURL()
    .withMessage('Success URL must be a valid URL'),
  body('redirect.failed')
    .isURL()
    .withMessage('Failed URL must be a valid URL')
];

// Validate payment link creation
exports.validatePaymentLink = [
  body('amount')
    .isNumeric()
    .withMessage('Amount must be a number')
    .isFloat({ gt: 0 })
    .withMessage('Amount must be greater than 0'),
  body('description')
    .optional()
    .isString()
    .withMessage('Description must be a string')
    .isLength({ min: 1, max: 255 })
    .withMessage('Description must be between 1 and 255 characters'),
  body('orderId')
    .optional()
    .isString()
    .withMessage('Order ID must be a string')
];

// Validate refund
exports.validateRefund = [
  body('paymentId')
    .notEmpty()
    .withMessage('Payment ID is required'),
  body('amount')
    .optional()
    .isNumeric()
    .withMessage('Amount must be a number')
    .isFloat({ gt: 0 })
    .withMessage('Amount must be greater than 0'),
  body('reason')
    .optional()
    .isIn(['requested_by_customer', 'duplicate', 'fraudulent'])
    .withMessage('Reason must be one of: requested_by_customer, duplicate, fraudulent')
];
