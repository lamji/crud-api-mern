const { body } = require('express-validator');

// Validation for creating orders
exports.validateCreateOrder = [
  body('customer.address')
    .if(body('deliveryType').equals('delivery'))
    .notEmpty()
    .withMessage('Customer address is required for delivery orders')
    .isLength({ min: 10, max: 200 })
    .withMessage('Address must be between 10 and 200 characters'),
  
  body('customer.phonenumber')
    .notEmpty()
    .withMessage('Customer phone number is required')
    .matches(/^[\d\s\-\+\(\)]+$/)
    .withMessage('Invalid phone number format'),
  
  body('deliveryType')
    .optional()
    .isIn(['pickup', 'delivery'])
    .withMessage('Delivery type must be pickup or delivery'),
  
  body('deliveryFee')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Delivery fee must be a positive number'),
  
  body('paymentMethod.type')
    .notEmpty()
    .withMessage('Payment method type is required')
    .isIn(['cash', 'card', 'ewallet'])
    .withMessage('Payment type must be cash, card, or ewallet'),
  
  // Cash payment validation - details must be null
  body('paymentMethod.details')
    .if(body('paymentMethod.type').equals('cash'))
    .custom((value) => {
      if (value !== null && value !== undefined) {
        throw new Error('Cash payments must have details set to null');
      }
      return true;
    }),
  
  // Card payment validation
  body('paymentMethod.details.cardType')
    .if(body('paymentMethod.type').equals('card'))
    .notEmpty()
    .withMessage('Card type is required for card payments')
    .isIn(['visa', 'mastercard', 'amex', 'discover'])
    .withMessage('Invalid card type'),
  
  body('paymentMethod.details.lastFour')
    .if(body('paymentMethod.type').equals('card'))
    .notEmpty()
    .withMessage('Last four digits are required for card payments')
    .matches(/^\d{4}$/)
    .withMessage('Last four digits must be exactly 4 digits'),
  
  body('paymentMethod.details.transactionId')
    .if(body('paymentMethod.type').equals('card'))
    .notEmpty()
    .withMessage('Transaction ID is required for card payments'),
  
  // E-wallet payment validation
  body('paymentMethod.details.provider')
    .if(body('paymentMethod.type').equals('ewallet'))
    .notEmpty()
    .withMessage('Provider is required for e-wallet payments')
    .isIn(['paypal', 'venmo', 'cashapp', 'zelle', 'applepay', 'googlepay'])
    .withMessage('Invalid e-wallet provider'),
  
  body('paymentMethod.details.accountEmail')
    .if(body('paymentMethod.type').equals('ewallet'))
    .notEmpty()
    .withMessage('Account email is required for e-wallet payments')
    .isEmail()
    .withMessage('Valid email is required for e-wallet'),
  
  body('paymentMethod.details.transactionId')
    .if(body('paymentMethod.type').equals('ewallet'))
    .notEmpty()
    .withMessage('Transaction ID is required for e-wallet payments'),
  
  body('items')
    .isArray({ min: 1 })
    .withMessage('At least one item is required'),
  
  body('items.*.product')
    .notEmpty()
    .withMessage('Product ID is required')
    .isMongoId()
    .withMessage('Invalid product ID format'),
  
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Item quantity must be at least 1'),
  
  body('items.*.price')
    .isFloat({ min: 0 })
    .withMessage('Item price must be a positive number')
];

// Validation for updating order status
exports.validateUpdateOrderStatus = [
  body('status')
    .optional()
    .isIn(['pending', 'received', 'preparing', 'shipped', 'delivered', 'cancelled'])
    .withMessage('Invalid status value'),
  
  body('paymentStatus')
    .optional()
    .isIn(['pending', 'paid', 'failed', 'refunded'])
    .withMessage('Invalid payment status value')
];
